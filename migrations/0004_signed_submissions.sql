PRAGMA foreign_keys = ON;

ALTER TABLE assets ADD COLUMN content_hash TEXT;

CREATE TABLE IF NOT EXISTS submission_upload_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('pfp', 'banner', 'icon')),
  public_id TEXT NOT NULL UNIQUE CHECK (
    length(trim(public_id)) > 0
    AND public_id NOT GLOB '*..*'
    AND public_id NOT GLOB '*\\*'
  ),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending')),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('pfp', 'banner', 'icon')),
  submitted_title TEXT NOT NULL CHECK (
    length(trim(submitted_title)) BETWEEN 2 AND 80
    AND submitted_title NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
  ),
  description TEXT CHECK (
    description IS NULL
    OR (
      length(description) <= 100
      AND description NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
    )
  ),
  creator_credit TEXT CHECK (
    creator_credit IS NULL
    OR (
      length(creator_credit) <= 80
      AND creator_credit NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
    )
  ),
  source_url TEXT CHECK (
    source_url IS NULL
    OR source_url GLOB 'http://*'
    OR source_url GLOB 'https://*'
  ),
  category_id TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  cloudinary_resource_type TEXT NOT NULL CHECK (cloudinary_resource_type = 'image'),
  cloudinary_format TEXT NOT NULL CHECK (cloudinary_format IN ('jpg', 'jpeg', 'png', 'webp', 'gif')),
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  content_hash TEXT NOT NULL,
  duplicate_pending_flag INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_pending_flag IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS submission_tags (
  submission_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (submission_id, tag_id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS submission_suggested_tags (
  submission_id TEXT NOT NULL,
  suggested_tag TEXT NOT NULL CHECK (
    length(trim(suggested_tag)) BETWEEN 2 AND 30
    AND suggested_tag NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
  ),
  PRIMARY KEY (submission_id, suggested_tag),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_content_hash
  ON assets(content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submission_upload_intents_user_created
  ON submission_upload_intents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_upload_intents_expires
  ON submission_upload_intents(expires_at);

CREATE INDEX IF NOT EXISTS idx_submission_upload_intents_user_consumed
  ON submission_upload_intents(user_id, consumed_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_submissions_user_created
  ON submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_created
  ON submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_content_hash_user
  ON submissions(content_hash, user_id);

CREATE INDEX IF NOT EXISTS idx_submissions_content_hash_status
  ON submissions(content_hash, status);

CREATE INDEX IF NOT EXISTS idx_submission_tags_tag
  ON submission_tags(tag_id, submission_id);
