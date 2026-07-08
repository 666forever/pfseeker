export interface AuthUser {
  id: string;
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  accountStatus: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface CurrentUser {
  user: AuthUser;
  session: AuthSession;
}

export interface DiscordUserProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
}

export interface OAuthStateRecord {
  id: string;
  stateHash: string;
  returnPath: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}
