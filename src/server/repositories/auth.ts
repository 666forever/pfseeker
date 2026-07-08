import type { D1DatabaseLike } from "@/server/db/d1";
import { DatabaseRowError } from "@/server/repositories/errors";
import type {
  AuthSession,
  AuthUser,
  DiscordUserProfile,
  OAuthStateRecord,
} from "@/server/auth/types";

interface UserRow {
  id: string;
  discord_user_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
  account_status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

interface OAuthStateRow {
  id: string;
  state_hash: string;
  return_path: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

function mapUser(row: UserRow): AuthUser {
  if (row.account_status !== "active" && row.account_status !== "disabled") {
    throw new DatabaseRowError("D1 user row has invalid account status.");
  }

  return {
    id: row.id,
    discordUserId: row.discord_user_id,
    username: row.username,
    globalName: row.global_name,
    avatarHash: row.avatar_hash,
    accountStatus: row.account_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function mapSession(row: SessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
  };
}

function mapOAuthState(row: OAuthStateRow): OAuthStateRecord {
  return {
    id: row.id,
    stateHash: row.state_hash,
    returnPath: row.return_path,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

export class AuthRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async findUserByDiscordId(discordUserId: string): Promise<AuthUser | null> {
    const row = await this.db
      .prepare(
        `SELECT id, discord_user_id, username, global_name, avatar_hash,
          account_status, created_at, updated_at, last_login_at
         FROM users
         WHERE discord_user_id = ?`,
      )
      .bind(discordUserId)
      .first<UserRow>();

    return row ? mapUser(row) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const row = await this.db
      .prepare(
        `SELECT id, discord_user_id, username, global_name, avatar_hash,
          account_status, created_at, updated_at, last_login_at
         FROM users
         WHERE id = ?`,
      )
      .bind(id)
      .first<UserRow>();

    return row ? mapUser(row) : null;
  }

  async upsertDiscordUser(profile: DiscordUserProfile): Promise<AuthUser> {
    const existing = await this.findUserByDiscordId(profile.id);
    const now = new Date().toISOString();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE users
           SET username = ?, global_name = ?, avatar_hash = ?,
             updated_at = ?, last_login_at = ?
           WHERE id = ?`,
        )
        .bind(
          profile.username,
          profile.globalName,
          profile.avatarHash,
          now,
          now,
          existing.id,
        )
        .run();

      return {
        ...existing,
        username: profile.username,
        globalName: profile.globalName,
        avatarHash: profile.avatarHash,
        updatedAt: now,
        lastLoginAt: now,
      };
    }

    const id = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO users (
          id, discord_user_id, username, global_name, avatar_hash,
          account_status, created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      )
      .bind(
        id,
        profile.id,
        profile.username,
        profile.globalName,
        profile.avatarHash,
        now,
        now,
        now,
      )
      .run();

    return {
      id,
      discordUserId: profile.id,
      username: profile.username,
      globalName: profile.globalName,
      avatarHash: profile.avatarHash,
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<AuthSession> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO sessions (
          id, user_id, token_hash, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.userId, input.tokenHash, now, input.expiresAt, now)
      .run();

    return {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: now,
      expiresAt: input.expiresAt,
      lastSeenAt: now,
      revokedAt: null,
    };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, token_hash, created_at, expires_at, last_seen_at,
          revoked_at
         FROM sessions
         WHERE token_hash = ?`,
      )
      .bind(tokenHash)
      .first<SessionRow>();

    return row ? mapSession(row) : null;
  }

  async touchSession(id: string, lastSeenAt: string): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?")
      .bind(lastSeenAt, id)
      .run();
  }

  async revokeSession(id: string): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();
  }

  async deleteExpiredSessions(now = new Date().toISOString()): Promise<void> {
    await this.db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .bind(now)
      .run();
  }

  async createOAuthState(input: {
    stateHash: string;
    returnPath: string;
    expiresAt: string;
  }): Promise<OAuthStateRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO oauth_states (
          id, state_hash, return_path, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, input.stateHash, input.returnPath, now, input.expiresAt)
      .run();

    return {
      id,
      stateHash: input.stateHash,
      returnPath: input.returnPath,
      createdAt: now,
      expiresAt: input.expiresAt,
      usedAt: null,
    };
  }

  async findOAuthStateByHash(
    stateHash: string,
  ): Promise<OAuthStateRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, state_hash, return_path, created_at, expires_at, used_at
         FROM oauth_states
         WHERE state_hash = ?`,
      )
      .bind(stateHash)
      .first<OAuthStateRow>();

    return row ? mapOAuthState(row) : null;
  }

  async markOAuthStateUsed(id: string): Promise<void> {
    await this.db
      .prepare("UPDATE oauth_states SET used_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();
  }

  async deleteExpiredOAuthStates(
    now = new Date().toISOString(),
  ): Promise<void> {
    await this.db
      .prepare("DELETE FROM oauth_states WHERE expires_at <= ?")
      .bind(now)
      .run();
  }
}
