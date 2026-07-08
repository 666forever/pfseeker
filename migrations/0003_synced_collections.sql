PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (
    length(trim(name)) BETWEEN 1 AND 80
    AND name NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
  ),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (collection_id, asset_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_collections_user_updated
  ON collections(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_visibility_updated
  ON collections(visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection_position
  ON collection_items(collection_id, position, added_at);

CREATE INDEX IF NOT EXISTS idx_collection_items_asset
  ON collection_items(asset_id, collection_id);
