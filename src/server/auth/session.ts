import type { APIContext, AstroGlobal } from "astro";
import { hmacSha256, randomToken } from "@/server/auth/crypto";
import {
  clearSessionCookie,
  type CookieJar,
  sessionCookieName,
  sessionExpiresAt,
  setSessionCookie,
} from "@/server/auth/cookies";
import type { AuthSession, AuthUser, CurrentUser } from "@/server/auth/types";
import { getAuthConfig, type AuthConfig } from "@/server/config";
import { getD1DatabaseAsync } from "@/server/db/d1";
import { AuthRepository } from "@/server/repositories/auth";

const lastSeenWriteIntervalMs = 1000 * 60 * 60;

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export async function hashSessionToken(
  token: string,
  config: Pick<AuthConfig, "sessionSecret">,
): Promise<string> {
  return hmacSha256(`session:${token}`, config.sessionSecret);
}

export async function createUserSession(input: {
  repository: AuthRepository;
  user: AuthUser;
  config: AuthConfig;
  cookies: CookieJar;
}): Promise<AuthSession> {
  const token = randomToken(32);
  const tokenHash = await hashSessionToken(token, input.config);
  const session = await input.repository.createSession({
    userId: input.user.id,
    tokenHash,
    expiresAt: sessionExpiresAt().toISOString(),
  });
  setSessionCookie(input.cookies, input.config, token);
  return session;
}

interface AuthContext {
  locals: AstroGlobal["locals"] | APIContext["locals"];
  cookies: CookieJar;
}

function activeSession(session: AuthSession, now = new Date()): boolean {
  return !session.revokedAt && Date.parse(session.expiresAt) > now.getTime();
}

async function maybeTouchSession(
  repository: AuthRepository,
  session: AuthSession,
): Promise<void> {
  const lastSeen = Date.parse(session.lastSeenAt);
  if (Number.isNaN(lastSeen)) return;
  if (Date.now() - lastSeen < lastSeenWriteIntervalMs) return;
  await repository.touchSession(session.id, new Date().toISOString());
}

export async function getOptionalUser(
  context: AuthContext,
): Promise<CurrentUser | null> {
  const rawToken = context.cookies.get(sessionCookieName)?.value;
  if (!rawToken) return null;

  const config = await getAuthConfig(context.locals);
  const repository = new AuthRepository(
    await getD1DatabaseAsync(context.locals),
  );
  const tokenHash = await hashSessionToken(rawToken, config);
  const session = await repository.findSessionByTokenHash(tokenHash);

  if (!session || !activeSession(session)) {
    clearSessionCookie(context.cookies);
    return null;
  }

  const user = await repository.findUserById(session.userId);
  if (!user || user.accountStatus !== "active") {
    clearSessionCookie(context.cookies);
    return null;
  }

  await maybeTouchSession(repository, session);
  return { user, session };
}

export async function requireUser(context: AuthContext): Promise<CurrentUser> {
  const currentUser = await getOptionalUser(context);
  if (!currentUser) throw new AuthenticationRequiredError();
  return currentUser;
}

export async function revokeCurrentSession(
  context: AuthContext,
): Promise<void> {
  const rawToken = context.cookies.get(sessionCookieName)?.value;
  clearSessionCookie(context.cookies);
  if (!rawToken) return;

  const config = await getAuthConfig(context.locals);
  const repository = new AuthRepository(
    await getD1DatabaseAsync(context.locals),
  );
  const session = await repository.findSessionByTokenHash(
    await hashSessionToken(rawToken, config),
  );
  if (session && !session.revokedAt) {
    await repository.revokeSession(session.id);
  }
}
