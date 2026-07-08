import type { SeedAsset } from "@/data/assets";
import type { D1DatabaseLike } from "@/server/db/d1";
import {
  DEFAULT_COLLECTION_VISIBILITY,
  validateCollectionName,
  validateReorderPayload,
  type CollectionVisibility,
} from "@/lib/collection";
import {
  DatabaseRowError,
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";

export interface CollectionSummary {
  id: string;
  userId: string;
  name: string;
  visibility: CollectionVisibility;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface CollectionItem {
  collectionId: string;
  assetId: string;
  position: number;
  addedAt: string;
  asset: SeedAsset | null;
}

export interface CollectionDetail extends CollectionSummary {
  items: CollectionItem[];
}

interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  item_count: number;
}

interface CollectionItemRow {
  collection_id: string;
  asset_id: string;
  position: number;
  added_at: string;
  slug: string | null;
  kind: string | null;
  title: string | null;
  alt_text: string | null;
  durable_media_ref: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  animation: string | null;
  palette_json: string | null;
  motif: SeedAsset["motif"] | null;
  published_at: string | null;
  category_slugs: string | null;
  tag_slugs: string | null;
}

function assertVisibility(value: string): CollectionVisibility {
  if (value === "private") return value;
  throw new DatabaseRowError("D1 collection row has invalid visibility.");
}

function mapCollection(row: CollectionRow): CollectionSummary {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    visibility: assertVisibility(row.visibility),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: Number(row.item_count),
  };
}

function parseSlugList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function mapAsset(row: CollectionItemRow): SeedAsset | null {
  if (!row.slug || !row.kind || !row.title || !row.alt_text) {
    return null;
  }

  if (row.kind !== "pfp" && row.kind !== "banner" && row.kind !== "icon") {
    throw new DatabaseRowError("D1 collection asset row has invalid kind.");
  }

  if (
    row.format !== "avif" &&
    row.format !== "gif" &&
    row.format !== "jpg" &&
    row.format !== "png" &&
    row.format !== "svg" &&
    row.format !== "webp"
  ) {
    throw new DatabaseRowError("D1 collection asset row has invalid format.");
  }

  if (row.animation !== "static" && row.animation !== "animated") {
    throw new DatabaseRowError(
      "D1 collection asset row has invalid animation state.",
    );
  }

  if (
    !row.durable_media_ref ||
    !row.width ||
    !row.height ||
    !row.palette_json ||
    !row.motif ||
    !row.published_at
  ) {
    return null;
  }

  const palette: unknown = JSON.parse(row.palette_json);
  if (
    !Array.isArray(palette) ||
    palette.length !== 3 ||
    !palette.every((entry) => typeof entry === "string")
  ) {
    throw new DatabaseRowError("D1 collection asset row has invalid palette.");
  }

  return {
    id: row.asset_id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    alt: row.alt_text,
    localSource: row.durable_media_ref,
    width: row.width,
    height: row.height,
    format: row.format,
    animation: row.animation,
    categories: parseSlugList(row.category_slugs),
    tags: parseSlugList(row.tag_slugs),
    publishedAt: row.published_at.slice(0, 10),
    palette: palette as [string, string, string],
    motif: row.motif,
  };
}

function mapItem(row: CollectionItemRow): CollectionItem {
  return {
    collectionId: row.collection_id,
    assetId: row.asset_id,
    position: row.position,
    addedAt: row.added_at,
    asset: mapAsset(row),
  };
}

function assertId(value: string, label: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
    throw new InvalidRepositoryInputError(`${label} is malformed.`);
  }
}

export class CollectionRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async listOwnedCollections(userId: string): Promise<CollectionSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT collections.id, collections.user_id, collections.name,
          collections.visibility, collections.created_at, collections.updated_at,
          COUNT(collection_items.asset_id) AS item_count
         FROM collections
         LEFT JOIN collection_items
           ON collection_items.collection_id = collections.id
         WHERE collections.user_id = ?
         GROUP BY collections.id
         ORDER BY collections.updated_at DESC, collections.created_at DESC`,
      )
      .bind(userId)
      .all<CollectionRow>();

    return results.map(mapCollection);
  }

  async countOwnedCollections(userId: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS count FROM collections WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async readOwnedCollection(
    userId: string,
    collectionId: string,
  ): Promise<CollectionDetail> {
    assertId(collectionId, "Collection ID");
    const summary = await this.findOwnedCollection(userId, collectionId);
    if (!summary) {
      throw new NotFoundError("Collection was not found.");
    }

    const { results } = await this.db
      .prepare(
        `SELECT
          collection_items.collection_id,
          collection_items.asset_id,
          collection_items.position,
          collection_items.added_at,
          assets.slug,
          assets.kind,
          assets.title,
          assets.alt_text,
          assets.durable_media_ref,
          assets.width,
          assets.height,
          assets.format,
          assets.animation,
          assets.palette_json,
          assets.motif,
          assets.published_at,
          (
            SELECT GROUP_CONCAT(categories.slug)
            FROM asset_categories
            JOIN categories ON categories.id = asset_categories.category_id
            WHERE asset_categories.asset_id = assets.id
            ORDER BY categories.slug ASC
          ) AS category_slugs,
          (
            SELECT GROUP_CONCAT(tags.slug)
            FROM asset_tags
            JOIN tags ON tags.id = asset_tags.tag_id
            WHERE asset_tags.asset_id = assets.id
            ORDER BY tags.slug ASC
          ) AS tag_slugs
         FROM collection_items
         LEFT JOIN assets
           ON assets.id = collection_items.asset_id
          AND assets.status = 'published'
         WHERE collection_items.collection_id = ?
         ORDER BY collection_items.position ASC, collection_items.added_at ASC`,
      )
      .bind(collectionId)
      .all<CollectionItemRow>();

    return { ...summary, items: results.map(mapItem) };
  }

  async createCollection(input: {
    userId: string;
    name: unknown;
  }): Promise<CollectionSummary> {
    const name = validateCollectionName(input.name);
    if (!name.ok) throw new InvalidRepositoryInputError(name.message);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO collections (
          id, user_id, name, visibility, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.userId,
        name.name,
        DEFAULT_COLLECTION_VISIBILITY,
        now,
        now,
      )
      .run();

    return {
      id,
      userId: input.userId,
      name: name.name,
      visibility: DEFAULT_COLLECTION_VISIBILITY,
      createdAt: now,
      updatedAt: now,
      itemCount: 0,
    };
  }

  async renameCollection(input: {
    userId: string;
    collectionId: string;
    name: unknown;
  }): Promise<CollectionSummary> {
    const name = validateCollectionName(input.name);
    if (!name.ok) throw new InvalidRepositoryInputError(name.message);
    const existing = await this.findOwnedCollection(
      input.userId,
      input.collectionId,
    );
    if (!existing) throw new NotFoundError("Collection was not found.");

    await this.db
      .prepare(
        `UPDATE collections
         SET name = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .bind(
        name.name,
        new Date().toISOString(),
        input.collectionId,
        input.userId,
      )
      .run();

    return this.readSummary(input.userId, input.collectionId);
  }

  async deleteCollection(input: {
    userId: string;
    collectionId: string;
  }): Promise<void> {
    const existing = await this.findOwnedCollection(
      input.userId,
      input.collectionId,
    );
    if (!existing) throw new NotFoundError("Collection was not found.");

    await this.db
      .prepare("DELETE FROM collections WHERE id = ? AND user_id = ?")
      .bind(input.collectionId, input.userId)
      .run();
  }

  async addAsset(input: {
    userId: string;
    collectionId: string;
    assetId: string;
  }): Promise<CollectionDetail> {
    assertId(input.collectionId, "Collection ID");
    const existing = await this.findOwnedCollection(
      input.userId,
      input.collectionId,
    );
    if (!existing) throw new NotFoundError("Collection was not found.");
    if (!(await this.assetExists(input.assetId))) {
      throw new NotFoundError("Asset was not found.");
    }

    const position = await this.nextPosition(input.collectionId);
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO collection_items (
          collection_id, asset_id, position, added_at
        ) VALUES (?, ?, ?, ?)`,
      )
      .bind(input.collectionId, input.assetId, position, now)
      .run();

    await this.touch(input.collectionId, input.userId);
    return this.readOwnedCollection(input.userId, input.collectionId);
  }

  async removeAsset(input: {
    userId: string;
    collectionId: string;
    assetId: string;
  }): Promise<CollectionDetail> {
    const existing = await this.findOwnedCollection(
      input.userId,
      input.collectionId,
    );
    if (!existing) throw new NotFoundError("Collection was not found.");

    await this.db
      .prepare(
        `DELETE FROM collection_items
         WHERE collection_id = ? AND asset_id = ?`,
      )
      .bind(input.collectionId, input.assetId)
      .run();

    await this.normalizePositions(input.collectionId, input.userId);
    return this.readOwnedCollection(input.userId, input.collectionId);
  }

  async reorderItems(input: {
    userId: string;
    collectionId: string;
    assetIds: unknown;
  }): Promise<CollectionDetail> {
    const detail = await this.readOwnedCollection(
      input.userId,
      input.collectionId,
    );
    const currentIds = detail.items.map((item) => item.assetId);
    const reorder = validateReorderPayload(currentIds, input.assetIds);
    if (!reorder.ok) throw new InvalidRepositoryInputError(reorder.message);

    if (reorder.assetIds.length > 0) {
      await this.db.batch(
        reorder.assetIds.map((assetId, index) =>
          this.db
            .prepare(
              `UPDATE collection_items
               SET position = ?
               WHERE collection_id = ? AND asset_id = ?`,
            )
            .bind(index, input.collectionId, assetId),
        ),
      );
    }
    await this.touch(input.collectionId, input.userId);
    return this.readOwnedCollection(input.userId, input.collectionId);
  }

  async findCollectionsContainingAsset(
    userId: string,
    assetId: string,
  ): Promise<Set<string>> {
    const { results } = await this.db
      .prepare(
        `SELECT collections.id
         FROM collections
         JOIN collection_items
           ON collection_items.collection_id = collections.id
         WHERE collections.user_id = ? AND collection_items.asset_id = ?`,
      )
      .bind(userId, assetId)
      .all<{ id: string }>();

    return new Set(results.map((row) => row.id));
  }

  private async readSummary(
    userId: string,
    collectionId: string,
  ): Promise<CollectionSummary> {
    const summary = await this.findOwnedCollection(userId, collectionId);
    if (!summary) throw new NotFoundError("Collection was not found.");
    return summary;
  }

  private async findOwnedCollection(
    userId: string,
    collectionId: string,
  ): Promise<CollectionSummary | null> {
    assertId(collectionId, "Collection ID");
    const row = await this.db
      .prepare(
        `SELECT collections.id, collections.user_id, collections.name,
          collections.visibility, collections.created_at, collections.updated_at,
          COUNT(collection_items.asset_id) AS item_count
         FROM collections
         LEFT JOIN collection_items
           ON collection_items.collection_id = collections.id
         WHERE collections.id = ? AND collections.user_id = ?
         GROUP BY collections.id`,
      )
      .bind(collectionId, userId)
      .first<CollectionRow>();

    return row ? mapCollection(row) : null;
  }

  private async assetExists(assetId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT id FROM assets WHERE id = ? AND status = 'published'")
      .bind(assetId)
      .first<{ id: string }>();
    return !!row;
  }

  private async nextPosition(collectionId: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
         FROM collection_items
         WHERE collection_id = ?`,
      )
      .bind(collectionId)
      .first<{ next_position: number }>();
    return Number(row?.next_position ?? 0);
  }

  private async normalizePositions(
    collectionId: string,
    userId: string,
  ): Promise<void> {
    const detail = await this.readOwnedCollection(userId, collectionId);
    if (detail.items.length > 0) {
      await this.db.batch(
        detail.items.map((item, index) =>
          this.db
            .prepare(
              `UPDATE collection_items
               SET position = ?
               WHERE collection_id = ? AND asset_id = ?`,
            )
            .bind(index, collectionId, item.assetId),
        ),
      );
    }
    await this.touch(collectionId, userId);
  }

  private async touch(collectionId: string, userId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE collections
         SET updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .bind(new Date().toISOString(), collectionId, userId)
      .run();
  }
}
