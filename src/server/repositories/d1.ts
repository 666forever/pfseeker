import type { SeedAsset } from "@/data/assets";
import type { SeedCategory } from "@/data/categories";
import { filterAssets } from "@/lib/search";
import type { AnimationState, AssetKind, MediaFormat } from "@/lib/media";
import type { D1DatabaseLike } from "@/server/db/d1";
import {
  DatabaseRowError,
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";
import type {
  ContentRepository,
  DownloadEventInput,
  DownloadEventResult,
} from "@/server/repositories/types";

const assetSelect = `
  SELECT
    id,
    slug,
    kind,
    title,
    alt_text,
    durable_media_ref,
    width,
    height,
    format,
    animation,
    palette_json,
    motif,
    published_at
  FROM assets
  WHERE status = 'published'
`;

const categorySelect = `
  SELECT id, slug, name, description, supported_kinds
  FROM categories
`;

interface AssetRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  alt_text: string;
  durable_media_ref: string;
  width: number;
  height: number;
  format: string;
  animation: string;
  palette_json: string;
  motif: SeedAsset["motif"];
  published_at: string;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  supported_kinds: string;
}

interface SlugRow {
  asset_id: string;
  slug: string;
}

function assertAssetKind(value: string): AssetKind {
  if (value === "pfp" || value === "banner" || value === "icon") return value;
  throw new DatabaseRowError(`Unsupported asset kind from D1: ${value}.`);
}

function assertMediaFormat(value: string): MediaFormat {
  if (
    value === "avif" ||
    value === "gif" ||
    value === "jpg" ||
    value === "png" ||
    value === "svg" ||
    value === "webp"
  ) {
    return value;
  }
  throw new DatabaseRowError(`Unsupported asset format from D1: ${value}.`);
}

function assertAnimation(value: string): AnimationState {
  if (value === "static" || value === "animated") return value;
  throw new DatabaseRowError(`Unsupported animation state from D1: ${value}.`);
}

function parsePalette(value: string): [string, string, string] {
  const parsed: unknown = JSON.parse(value);
  if (
    Array.isArray(parsed) &&
    parsed.length === 3 &&
    parsed.every((entry) => typeof entry === "string")
  ) {
    return parsed as [string, string, string];
  }
  throw new DatabaseRowError("D1 asset row has invalid palette metadata.");
}

function mapAsset(
  row: AssetRow,
  categoriesByAssetId: Map<string, string[]>,
  tagsByAssetId: Map<string, string[]>,
): SeedAsset {
  return {
    id: row.id,
    slug: row.slug,
    kind: assertAssetKind(row.kind),
    title: row.title,
    alt: row.alt_text,
    localSource: row.durable_media_ref,
    width: row.width,
    height: row.height,
    format: assertMediaFormat(row.format),
    animation: assertAnimation(row.animation),
    categories: categoriesByAssetId.get(row.id) ?? [],
    tags: tagsByAssetId.get(row.id) ?? [],
    publishedAt: row.published_at.slice(0, 10),
    palette: parsePalette(row.palette_json),
    motif: row.motif,
  };
}

function mapCategory(row: CategoryRow): SeedCategory {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    kinds: row.supported_kinds
      .split(",")
      .map((kind) => assertAssetKind(kind.trim()))
      .filter(Boolean),
  };
}

function groupSlugs(rows: SlugRow[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    grouped.set(row.asset_id, [...(grouped.get(row.asset_id) ?? []), row.slug]);
  }
  return grouped;
}

export class D1ContentRepository implements ContentRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async listAssets(filters?: Parameters<ContentRepository["listAssets"]>[0]) {
    const assets = await this.readPublishedAssets();
    return filters ? filterAssets(filters, assets) : assets;
  }

  async searchAssets(
    filters: Parameters<ContentRepository["searchAssets"]>[0],
  ) {
    return filterAssets(filters, await this.readPublishedAssets());
  }

  async getAssetById(id: string) {
    if (!id.trim()) return undefined;
    return (await this.readPublishedAssets()).find((asset) => asset.id === id);
  }

  async getAssetByKindAndSlug(kind: AssetKind, slug: string) {
    if (!slug.trim()) return undefined;
    return (await this.readPublishedAssets()).find(
      (asset) => asset.kind === kind && asset.slug === slug,
    );
  }

  async listCategories(kind?: AssetKind) {
    const { results } = await this.db
      .prepare(`${categorySelect} ORDER BY name ASC`)
      .all<CategoryRow>();
    const categories = results.map(mapCategory);
    return kind
      ? categories.filter((category) => category.kinds.includes(kind))
      : categories;
  }

  async listTags() {
    const { results } = await this.db
      .prepare("SELECT slug FROM tags ORDER BY slug ASC")
      .all<{ slug: string }>();
    return results.map((row) => row.slug);
  }

  async getRelatedAssets(asset: SeedAsset, limit = 4) {
    const assets = await this.readPublishedAssets();
    return assets
      .filter((candidate) => candidate.id !== asset.id)
      .map((candidate) => {
        const sharedCategories = candidate.categories.filter((category) =>
          asset.categories.includes(category),
        ).length;
        const sharedTags = candidate.tags.filter((tag) =>
          asset.tags.includes(tag),
        ).length;
        const sameKind = candidate.kind === asset.kind ? 1 : 0;

        return {
          candidate,
          score: sameKind * 100 + sharedCategories * 10 + sharedTags,
        };
      })
      .sort((a, b) => {
        return (
          b.score - a.score ||
          b.candidate.publishedAt.localeCompare(a.candidate.publishedAt) ||
          a.candidate.title.localeCompare(b.candidate.title) ||
          a.candidate.id.localeCompare(b.candidate.id)
        );
      })
      .slice(0, limit)
      .map((entry) => entry.candidate);
  }

  async recordDownload(
    input: DownloadEventInput,
  ): Promise<DownloadEventResult> {
    const assetId = input.assetId.trim();
    const source = input.source ?? "api";

    if (!assetId) {
      throw new InvalidRepositoryInputError(
        "A download event needs an asset ID.",
      );
    }
    if (source !== "api" && source !== "preview" && source !== "original") {
      throw new InvalidRepositoryInputError("Unsupported download source.");
    }
    if (!(await this.getAssetById(assetId))) {
      throw new NotFoundError(`Asset ${assetId} was not found.`);
    }

    const id = crypto.randomUUID();
    await this.db
      .prepare(
        "INSERT INTO downloads (id, asset_id, source, created_at) VALUES (?, ?, ?, datetime('now'))",
      )
      .bind(id, assetId, source)
      .run();

    return { id, assetId, recorded: true };
  }

  private async readPublishedAssets(): Promise<SeedAsset[]> {
    const [assetRows, categoryRows, tagRows] = await Promise.all([
      this.db
        .prepare(`${assetSelect} ORDER BY published_at DESC, title ASC`)
        .all<AssetRow>(),
      this.db
        .prepare(
          `SELECT asset_categories.asset_id, categories.slug
           FROM asset_categories
           JOIN categories ON categories.id = asset_categories.category_id
           ORDER BY categories.slug ASC`,
        )
        .all<SlugRow>(),
      this.db
        .prepare(
          `SELECT asset_tags.asset_id, tags.slug
           FROM asset_tags
           JOIN tags ON tags.id = asset_tags.tag_id
           ORDER BY tags.slug ASC`,
        )
        .all<SlugRow>(),
    ]);

    const categoriesByAssetId = groupSlugs(categoryRows.results);
    const tagsByAssetId = groupSlugs(tagRows.results);

    return assetRows.results.map((row) =>
      mapAsset(row, categoriesByAssetId, tagsByAssetId),
    );
  }
}
