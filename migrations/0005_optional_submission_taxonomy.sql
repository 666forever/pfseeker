PRAGMA foreign_keys = OFF;

CREATE TABLE submissions_new (
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
  category_id TEXT,
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

INSERT INTO submissions_new (
  id, user_id, status, asset_type, submitted_title, description,
  creator_credit, source_url, category_id, cloudinary_public_id,
  cloudinary_resource_type, cloudinary_format, bytes, width, height,
  content_hash, duplicate_pending_flag, created_at
)
SELECT
  id, user_id, status, asset_type, submitted_title, description,
  creator_credit, source_url, category_id, cloudinary_public_id,
  cloudinary_resource_type, cloudinary_format, bytes, width, height,
  content_hash, duplicate_pending_flag, created_at
FROM submissions;

DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;

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

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
