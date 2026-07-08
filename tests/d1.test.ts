import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { seedAssets } from "@/data/assets";
import { seedCategories } from "@/data/categories";
import { parseSearchFilters } from "@/lib/search";
import type { AstroGlobal } from "astro";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@/server/db/d1";
import { createContentRepository } from "@/server/repositories";
import { D1ContentRepository } from "@/server/repositories/d1";
import { createSeedRepository } from "@/server/repositories/seed";
import { generateSeedSql } from "../scripts/seed-d1";

class FakeStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly db: FakeD1Database,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    return { results: this.db.resultsFor<T>(this.query) };
  }

  async run(): Promise<{ success: boolean; meta?: unknown }> {
    this.db.runs.push({ query: this.query, values: this.values });
    return { success: true };
  }
}

class FakeD1Database implements D1DatabaseLike {
  runs: { query: string; values: unknown[] }[] = [];

  prepare(query: string): D1PreparedStatementLike {
    return new FakeStatement(query, this);
  }

  async batch<T = unknown>(): Promise<T[]> {
    return [];
  }

  resultsFor<T>(query: string): T[] {
    if (query.includes("FROM assets")) {
      return seedAssets.map((asset) => ({
        id: asset.id,
        slug: asset.slug,
        kind: asset.kind,
        title: asset.title,
        alt_text: asset.alt,
        durable_media_ref: asset.localSource,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        animation: asset.animation,
        palette_json: JSON.stringify(asset.palette),
        motif: asset.motif,
        published_at: `${asset.publishedAt}T00:00:00.000Z`,
      })) as T[];
    }

    if (query.includes("FROM asset_categories")) {
      return seedAssets.flatMap((asset) =>
        asset.categories.map((slug) => ({ asset_id: asset.id, slug })),
      ) as T[];
    }

    if (query.includes("FROM asset_tags")) {
      return seedAssets.flatMap((asset) =>
        asset.tags.map((slug) => ({ asset_id: asset.id, slug })),
      ) as T[];
    }

    if (query.includes("FROM categories")) {
      return seedCategories.map((category) => ({
        id: `category-${category.slug}`,
        slug: category.slug,
        name: category.name,
        description: category.description,
        supported_kinds: category.kinds.join(","),
      })) as T[];
    }

    if (query.includes("FROM tags")) {
      return Array.from(new Set(seedAssets.flatMap((asset) => asset.tags)))
        .sort()
        .map((slug) => ({ slug })) as T[];
    }

    return [];
  }
}

describe("D1 schema and seed import", () => {
  it("declares the required content and event tables without user records", () => {
    const migration = readFileSync(
      "migrations/0001_initial_schema.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS assets");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS categories");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS tags");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS downloads");
    expect(migration).toContain("FOREIGN KEY (asset_id) REFERENCES assets(id)");
    expect(migration).not.toMatch(/CREATE TABLE IF NOT EXISTS users/i);
  });

  it("generates idempotent SQL for every seed asset and taxonomy record", () => {
    const sql = generateSeedSql();

    expect(sql).toContain("BEGIN TRANSACTION;");
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(sql).toContain("COMMIT;");
    expect(sql.match(/INSERT INTO assets/g)).toHaveLength(seedAssets.length);
    expect(sql.match(/INSERT INTO categories/g)).toHaveLength(
      seedCategories.length,
    );
  });
});

describe("content repositories", () => {
  it("keeps seed fallback search semantics intact", async () => {
    const repository = createSeedRepository();
    const filters = parseSearchFilters(
      new URLSearchParams("type=pfp&category=dark&sort=oldest"),
    );

    const assets = await repository.searchAssets(filters);

    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every((asset) => asset.kind === "pfp")).toBe(true);
    expect(assets.every((asset) => asset.categories.includes("dark"))).toBe(
      true,
    );
  });

  it("maps D1 rows to public asset records and records download events", async () => {
    const db = new FakeD1Database();
    const repository = new D1ContentRepository(db);
    const asset = await repository.getAssetByKindAndSlug("pfp", "ember-orbit");

    expect(asset?.id).toBe("pfp-ember-orbit");
    expect(asset?.categories).toContain("dark");

    const result = await repository.recordDownload({
      assetId: "pfp-ember-orbit",
      source: "preview",
    });

    expect(result).toMatchObject({
      assetId: "pfp-ember-orbit",
      recorded: true,
    });
    expect(db.runs[0]?.query).toContain("INSERT INTO downloads");
    expect(db.runs[0]?.values[1]).toBe("pfp-ember-orbit");
  });

  it("uses seed fallback outside Cloudflare runtime", async () => {
    const repository = await createContentRepository(
      {} as AstroGlobal["locals"],
    );

    await expect(
      repository.getAssetById("pfp-ember-orbit"),
    ).resolves.toMatchObject({
      id: "pfp-ember-orbit",
    });
  });

  it("uses D1 when DB is bound", async () => {
    const repository = await createContentRepository({
      runtime: { env: { DB: new FakeD1Database() } },
    } as unknown as AstroGlobal["locals"]);

    expect(repository).toBeInstanceOf(D1ContentRepository);
  });

  it("fails safely in Cloudflare runtime without DB", async () => {
    await expect(
      createContentRepository({
        runtime: { env: { CF_PAGES: "1" } },
      } as unknown as AstroGlobal["locals"]),
    ).rejects.toThrow("Cloudflare D1 binding DB is missing");
  });
});
