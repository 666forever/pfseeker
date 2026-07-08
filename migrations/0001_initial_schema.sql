PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pfp', 'banner', 'icon')),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  alt_text TEXT NOT NULL CHECK (length(trim(alt_text)) > 0),
  media_source_type TEXT NOT NULL CHECK (media_source_type IN ('local_seed', 'cloudinary')),
  durable_media_ref TEXT NOT NULL CHECK (length(trim(durable_media_ref)) > 0),
  cloudinary_public_id TEXT,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  format TEXT NOT NULL CHECK (format IN ('avif', 'gif', 'jpg', 'png', 'svg', 'webp')),
  animation TEXT NOT NULL CHECK (animation IN ('static', 'animated')),
  palette_json TEXT NOT NULL,
  motif TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, slug),
  CHECK (
    (media_source_type = 'cloudinary' AND cloudinary_public_id IS NOT NULL)
    OR (media_source_type = 'local_seed' AND cloudinary_public_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (length(trim(slug)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  supported_kinds TEXT NOT NULL CHECK (length(trim(supported_kinds)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (length(trim(slug)) > 0),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS asset_categories (
  asset_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (asset_id, category_id),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS asset_tags (
  asset_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (asset_id, tag_id),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'preview', 'original')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_assets_kind_slug ON assets(kind, slug);
CREATE INDEX IF NOT EXISTS idx_assets_status_published ON assets(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_kind_status_published ON assets(kind, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_format ON assets(format);
CREATE INDEX IF NOT EXISTS idx_assets_animation ON assets(animation);
CREATE INDEX IF NOT EXISTS idx_asset_categories_category ON asset_categories(category_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_downloads_asset_created ON downloads(asset_id, created_at DESC);
