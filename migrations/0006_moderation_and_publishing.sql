PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS moderator_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'moderator')),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_by_user_id TEXT,
  revoked_at TEXT,
  reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderator_memberships_active_user
  ON moderator_memberships(user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_moderator_memberships_user_status
  ON moderator_memberships(user_id, status);

CREATE INDEX IF NOT EXISTS idx_moderator_memberships_role_status
  ON moderator_memberships(role, status);

CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  target_type TEXT NOT NULL CHECK (
    target_type IN (
      'submission',
      'asset',
      'category',
      'tag',
      'moderator_membership'
    )
  ),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (length(trim(action)) > 0),
  previous_state TEXT,
  new_state TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_target_time
  ON moderation_events(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_events_actor_time
  ON moderation_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_events_action_time
  ON moderation_events(action, created_at DESC);

ALTER TABLE assets ADD COLUMN description TEXT;
ALTER TABLE assets ADD COLUMN creator_credit TEXT;
ALTER TABLE assets ADD COLUMN source_url TEXT;
ALTER TABLE assets ADD COLUMN submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN archived_at TEXT;
ALTER TABLE assets ADD COLUMN archived_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN archive_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_submission_id
  ON assets(submission_id)
  WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_submitted_by
  ON assets(submitted_by_user_id, published_at DESC);

ALTER TABLE categories ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tags ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tags ADD COLUMN updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE submissions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'published', 'rejected')
  ),
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
  cloudinary_public_id TEXT UNIQUE,
  cloudinary_resource_type TEXT NOT NULL CHECK (cloudinary_resource_type = 'image'),
  cloudinary_format TEXT NOT NULL CHECK (cloudinary_format IN ('jpg', 'jpeg', 'png', 'webp', 'gif')),
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  content_hash TEXT NOT NULL,
  duplicate_pending_flag INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_pending_flag IN (0, 1)),
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  published_asset_id TEXT,
  rejection_reason_public TEXT CHECK (
    rejection_reason_public IS NULL
    OR (
      length(rejection_reason_public) <= 500
      AND rejection_reason_public NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
    )
  ),
  rejection_note_internal TEXT CHECK (
    rejection_note_internal IS NULL
    OR (
      length(rejection_note_internal) BETWEEN 2 AND 1000
      AND rejection_note_internal NOT GLOB '*[' || char(0) || '-' || char(31) || char(127) || ']*'
    )
  ),
  media_cleanup_status TEXT NOT NULL DEFAULT 'pending_media_present' CHECK (
    media_cleanup_status IN (
      'pending_media_present',
      'pending_media_deleted',
      'cleanup_failed'
    )
  ),
  review_version INTEGER NOT NULL DEFAULT 0 CHECK (review_version >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (published_asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

INSERT INTO submissions_new (
  id,
  user_id,
  status,
  asset_type,
  submitted_title,
  description,
  creator_credit,
  source_url,
  category_id,
  cloudinary_public_id,
  cloudinary_resource_type,
  cloudinary_format,
  bytes,
  width,
  height,
  content_hash,
  duplicate_pending_flag,
  created_at
)
SELECT
  id,
  user_id,
  status,
  asset_type,
  submitted_title,
  description,
  creator_credit,
  source_url,
  category_id,
  cloudinary_public_id,
  cloudinary_resource_type,
  cloudinary_format,
  bytes,
  width,
  height,
  content_hash,
  duplicate_pending_flag,
  created_at
FROM submissions;

DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;

CREATE INDEX IF NOT EXISTS idx_submissions_user_created
  ON submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_user_status_created
  ON submissions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_created
  ON submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_content_hash_user
  ON submissions(content_hash, user_id);

CREATE INDEX IF NOT EXISTS idx_submissions_content_hash_status
  ON submissions(content_hash, status);

CREATE INDEX IF NOT EXISTS idx_submissions_published_asset
  ON submissions(published_asset_id)
  WHERE published_asset_id IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
