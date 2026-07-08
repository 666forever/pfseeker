import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { seedAssets } from "@/data/assets";
import {
  safeCollectionDownloadName,
  validateCollectionName,
  validateReorderPayload,
} from "@/lib/collection";
import {
  createCollectionZip,
  sanitizeFilename,
  settleWithConcurrency,
  zipPathForAsset,
} from "@/lib/collection-zip";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@/server/db/d1";
import { CollectionRepository } from "@/server/repositories/collections";

interface CollectionRecord {
  id: string;
  user_id: string;
  name: string;
  visibility: "private";
  created_at: string;
  updated_at: string;
}

interface ItemRecord {
  collection_id: string;
  asset_id: string;
  position: number;
  added_at: string;
}

class FakeCollectionStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly db: FakeCollectionD1,
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
    return { results: this.db.resultsFor<T>(this.query, this.values) };
  }

  async run(): Promise<{ success: boolean; meta?: unknown }> {
    this.db.run(this.query, this.values);
    return { success: true };
  }
}

class FakeCollectionD1 implements D1DatabaseLike {
  collections = new Map<string, CollectionRecord>();
  items: ItemRecord[] = [];

  prepare(query: string): D1PreparedStatementLike {
    return new FakeCollectionStatement(query, this);
  }

  async batch<T = unknown>(
    statements: D1PreparedStatementLike[],
  ): Promise<T[]> {
    for (const statement of statements) {
      await statement.run();
    }
    return [] as T[];
  }

  resultsFor<T>(query: string, values: unknown[]): T[] {
    if (query.includes("COUNT(*) AS count")) {
      const [userId] = values;
      return [
        {
          count: Array.from(this.collections.values()).filter(
            (collection) => collection.user_id === userId,
          ).length,
        },
      ] as T[];
    }

    if (query.includes("SELECT id FROM assets")) {
      return seedAssets.some((asset) => asset.id === values[0])
        ? ([{ id: values[0] }] as T[])
        : [];
    }

    if (query.includes("next_position")) {
      const [collectionId] = values;
      const positions = this.items
        .filter((item) => item.collection_id === collectionId)
        .map((item) => item.position);
      return [
        { next_position: positions.length ? Math.max(...positions) + 1 : 0 },
      ] as T[];
    }

    if (query.includes("SELECT collections.id") && query.includes("GROUP BY")) {
      const rows = this.collectionRows(values);
      return rows as T[];
    }

    if (
      query.includes("FROM collection_items") &&
      query.includes("LEFT JOIN assets")
    ) {
      const [collectionId] = values;
      return this.items
        .filter((item) => item.collection_id === collectionId)
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const asset = seedAssets.find(
            (candidate) => candidate.id === item.asset_id,
          );
          return {
            collection_id: item.collection_id,
            asset_id: item.asset_id,
            position: item.position,
            added_at: item.added_at,
            slug: asset?.slug ?? null,
            kind: asset?.kind ?? null,
            title: asset?.title ?? null,
            alt_text: asset?.alt ?? null,
            durable_media_ref: asset?.localSource ?? null,
            width: asset?.width ?? null,
            height: asset?.height ?? null,
            format: asset?.format ?? null,
            animation: asset?.animation ?? null,
            palette_json: asset ? JSON.stringify(asset.palette) : null,
            motif: asset?.motif ?? null,
            published_at: asset ? `${asset.publishedAt}T00:00:00.000Z` : null,
            category_slugs: asset?.categories.join(",") ?? null,
            tag_slugs: asset?.tags.join(",") ?? null,
          };
        }) as T[];
    }

    if (query.includes("JOIN collection_items")) {
      const [userId, assetId] = values;
      return Array.from(this.collections.values())
        .filter((collection) => collection.user_id === userId)
        .filter((collection) =>
          this.items.some(
            (item) =>
              item.collection_id === collection.id && item.asset_id === assetId,
          ),
        )
        .map((collection) => ({ id: collection.id })) as T[];
    }

    return [];
  }

  run(query: string, values: unknown[]): void {
    if (query.includes("INSERT INTO collections")) {
      const [id, userId, name, visibility, createdAt, updatedAt] = values;
      this.collections.set(String(id), {
        id: String(id),
        user_id: String(userId),
        name: String(name),
        visibility: visibility as "private",
        created_at: String(createdAt),
        updated_at: String(updatedAt),
      });
    }

    if (query.includes("UPDATE collections") && query.includes("SET name")) {
      const [name, updatedAt, collectionId, userId] = values;
      const collection = this.collections.get(String(collectionId));
      if (collection && collection.user_id === userId) {
        collection.name = String(name);
        collection.updated_at = String(updatedAt);
      }
    }

    if (query.includes("DELETE FROM collections")) {
      const [collectionId, userId] = values;
      const collection = this.collections.get(String(collectionId));
      if (collection?.user_id === userId) {
        this.collections.delete(String(collectionId));
        this.items = this.items.filter(
          (item) => item.collection_id !== collectionId,
        );
      }
    }

    if (query.includes("INSERT OR IGNORE INTO collection_items")) {
      const [collectionId, assetId, position, addedAt] = values;
      if (
        !this.items.some(
          (item) =>
            item.collection_id === collectionId && item.asset_id === assetId,
        )
      ) {
        this.items.push({
          collection_id: String(collectionId),
          asset_id: String(assetId),
          position: Number(position),
          added_at: String(addedAt),
        });
      }
    }

    if (query.includes("DELETE FROM collection_items")) {
      const [collectionId, assetId] = values;
      this.items = this.items.filter(
        (item) =>
          item.collection_id !== collectionId || item.asset_id !== assetId,
      );
    }

    if (query.includes("UPDATE collection_items")) {
      const [position, collectionId, assetId] = values;
      const item = this.items.find(
        (candidate) =>
          candidate.collection_id === collectionId &&
          candidate.asset_id === assetId,
      );
      if (item) item.position = Number(position);
    }
  }

  private collectionRows(values: unknown[]): unknown[] {
    const [first, second] = values;
    const rows = Array.from(this.collections.values()).filter((collection) => {
      if (second)
        return collection.id === first && collection.user_id === second;
      return collection.user_id === first;
    });

    return rows.map((collection) => ({
      ...collection,
      item_count: this.items.filter(
        (item) => item.collection_id === collection.id,
      ).length,
    }));
  }
}

describe("collection naming and ordering", () => {
  it("validates private collection names without local storage", () => {
    expect(validateCollectionName("  My   Set  ")).toEqual({
      ok: true,
      name: "My Set",
    });
    expect(validateCollectionName("")).toMatchObject({ ok: false });
    expect(validateCollectionName("line\nbreak")).toMatchObject({ ok: false });
    expect(validateCollectionName("x".repeat(81))).toMatchObject({ ok: false });
    expect(safeCollectionDownloadName(" ../My Set ")).toBe("my-set");
  });

  it("normalizes reorder payloads and rejects duplicates or missing items", () => {
    expect(validateReorderPayload(["a", "b"], ["b", "a"])).toEqual({
      ok: true,
      assetIds: ["b", "a"],
    });
    expect(validateReorderPayload(["a", "b"], ["a", "a"])).toMatchObject({
      ok: false,
    });
    expect(validateReorderPayload(["a", "b"], ["a"])).toMatchObject({
      ok: false,
    });
    expect(validateReorderPayload(["a"], ["a", 1])).toMatchObject({
      ok: false,
    });
  });
});

describe("collection migration", () => {
  it("adds private user-owned collections and indexed collection items", () => {
    const migration = readFileSync(
      "migrations/0003_synced_collections.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS collections");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS collection_items");
    expect(migration).toContain("REFERENCES users(id) ON DELETE CASCADE");
    expect(migration).toContain("REFERENCES assets(id) ON DELETE RESTRICT");
    expect(migration).toContain("visibility TEXT NOT NULL DEFAULT 'private'");
    expect(migration).toContain("PRIMARY KEY (collection_id, asset_id)");
    expect(migration).toContain("idx_collections_user_updated");
    expect(migration).toContain("idx_collection_items_collection_position");
    expect(migration).not.toMatch(/localStorage|pfseeker\.collection\.v1/);
  });
});

describe("collection repository", () => {
  it("creates multiple private collections for one user and allows duplicate names", async () => {
    const repository = new CollectionRepository(new FakeCollectionD1());
    const first = await repository.createCollection({
      userId: "user-1",
      name: "Favorites",
    });
    const second = await repository.createCollection({
      userId: "user-1",
      name: "Favorites",
    });

    expect(first.name).toBe("Favorites");
    expect(second.name).toBe("Favorites");
    expect(first.id).not.toBe(second.id);
  });

  it("enforces ownership for reads and mutations", async () => {
    const repository = new CollectionRepository(new FakeCollectionD1());
    const collection = await repository.createCollection({
      userId: "owner",
      name: "Private",
    });

    await expect(
      repository.readOwnedCollection("other-user", collection.id),
    ).rejects.toThrow("Collection was not found");
    await expect(
      repository.renameCollection({
        userId: "other-user",
        collectionId: collection.id,
        name: "Nope",
      }),
    ).rejects.toThrow("Collection was not found");
  });

  it("adds, deduplicates, removes, and reorders existing assets", async () => {
    const repository = new CollectionRepository(new FakeCollectionD1());
    const collection = await repository.createCollection({
      userId: "owner",
      name: "Set",
    });

    await repository.addAsset({
      userId: "owner",
      collectionId: collection.id,
      assetId: seedAssets[0].id,
    });
    await repository.addAsset({
      userId: "owner",
      collectionId: collection.id,
      assetId: seedAssets[0].id,
    });
    await repository.addAsset({
      userId: "owner",
      collectionId: collection.id,
      assetId: seedAssets[1].id,
    });

    let detail = await repository.readOwnedCollection("owner", collection.id);
    expect(detail.items.map((item) => item.assetId)).toEqual([
      seedAssets[0].id,
      seedAssets[1].id,
    ]);

    detail = await repository.reorderItems({
      userId: "owner",
      collectionId: collection.id,
      assetIds: [seedAssets[1].id, seedAssets[0].id],
    });
    expect(detail.items.map((item) => item.assetId)).toEqual([
      seedAssets[1].id,
      seedAssets[0].id,
    ]);

    detail = await repository.removeAsset({
      userId: "owner",
      collectionId: collection.id,
      assetId: seedAssets[1].id,
    });
    expect(detail.items.map((item) => item.assetId)).toEqual([
      seedAssets[0].id,
    ]);
  });

  it("rejects invalid asset references", async () => {
    const repository = new CollectionRepository(new FakeCollectionD1());
    const collection = await repository.createCollection({
      userId: "owner",
      name: "Set",
    });

    await expect(
      repository.addAsset({
        userId: "owner",
        collectionId: collection.id,
        assetId: "missing-asset",
      }),
    ).rejects.toThrow("Asset was not found");
  });
});

describe("collection ZIP creation", () => {
  it("uses safe, kind-scoped SVG filenames", () => {
    expect(sanitizeFilename(" A messy/name!.svg ")).toBe("a-messy-name-.svg");
    expect(zipPathForAsset(seedAssets[0])).toBe("pfps/ember-orbit.svg");
    expect(
      zipPathForAsset(seedAssets.find((asset) => asset.kind === "banner")!),
    ).toBe("banners/slate-horizon.svg");
  });

  it("settles concurrent work without rejecting the whole batch", async () => {
    const results = await settleWithConcurrency(
      [
        async () => "first",
        async () => {
          throw new Error("second failed");
        },
        async () => "third",
      ],
      2,
    );

    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
  });

  it("creates a complete ZIP when every asset fetch succeeds", async () => {
    const controller = new AbortController();
    const progress: string[] = [];

    const result = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      signal: controller.signal,
      fetcher: async () => new Blob(["<svg></svg>"], { type: "image/svg+xml" }),
      onProgress: (next) => progress.push(next.phase),
    });

    expect(result.status).toBe("complete");
    expect(result.completed).toBe(2);
    expect(result.failures).toEqual([]);
    expect(result.blob?.size).toBeGreaterThan(0);
    expect(progress).toContain("creating");
    expect(progress).toContain("complete");
  });

  it("returns a partial ZIP when only some asset fetches fail", async () => {
    const controller = new AbortController();

    const result = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      signal: controller.signal,
      fetcher: async (url) => {
        if (url.includes(seedAssets[1].id)) {
          throw new Error("network failed");
        }

        return new Blob(["<svg></svg>"], { type: "image/svg+xml" });
      },
    });

    expect(result.status).toBe("partial");
    expect(result.completed).toBe(1);
    expect(result.failures).toEqual([
      {
        assetId: seedAssets[1].id,
        title: seedAssets[1].title,
        reason: "network failed",
      },
    ]);
    expect(result.blob?.size).toBeGreaterThan(0);
  });

  it("reports all-failure and empty collection download attempts", async () => {
    const failed = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      signal: new AbortController().signal,
      fetcher: async () => {
        throw new Error("offline");
      },
    });

    expect(failed.status).toBe("failed");
    expect(failed.failures).toHaveLength(2);

    const empty = await createCollectionZip({
      assets: [],
      signal: new AbortController().signal,
    });

    expect(empty).toMatchObject({
      status: "failed",
      completed: 0,
      total: 0,
      failures: [],
    });
  });

  it("supports cancellation through AbortController", async () => {
    const controller = new AbortController();

    const result = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      concurrency: 1,
      signal: controller.signal,
      fetcher: async () => {
        controller.abort();
        throw new DOMException("Download cancelled.", "AbortError");
      },
    });

    expect(result.status).toBe("cancelled");
    expect(result.completed).toBe(0);
  });
});
