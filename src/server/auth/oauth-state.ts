import type { APIContext, AstroGlobal } from "astro";
import {
  clearOAuthStateCookie,
  oauthStateMaxAgeSeconds,
} from "@/server/auth/cookies";
import {
  constantTimeEqual,
  hmacSha256,
  randomToken,
} from "@/server/auth/crypto";
import { safeReturnPath } from "@/server/auth/redirects";
import type { AuthConfig } from "@/server/config";
import { AuthRepository } from "@/server/repositories/auth";

export class OAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthStateError";
  }
}

export async function stateHash(
  state: string,
  config: Pick<AuthConfig, "sessionSecret">,
): Promise<string> {
  return hmacSha256(`oauth-state:${state}`, config.sessionSecret);
}

export async function createOAuthState(input: {
  repository: AuthRepository;
  config: AuthConfig;
  returnTo: string | null;
}): Promise<{ state: string; returnPath: string }> {
  await input.repository.deleteExpiredOAuthStates();
  const state = randomToken(32);
  const returnPath = safeReturnPath(input.returnTo);
  await input.repository.createOAuthState({
    stateHash: await stateHash(state, input.config),
    returnPath,
    expiresAt: new Date(
      Date.now() + oauthStateMaxAgeSeconds * 1000,
    ).toISOString(),
  });
  return { state, returnPath };
}

export async function consumeOAuthState(input: {
  repository: AuthRepository;
  config: AuthConfig;
  queryState: string | null;
  cookieState: string | undefined;
  cookies: AstroGlobal["cookies"] | APIContext["cookies"];
}): Promise<string> {
  if (!input.queryState || !input.cookieState) {
    throw new OAuthStateError("The sign-in state was missing.");
  }
  if (!constantTimeEqual(input.queryState, input.cookieState)) {
    throw new OAuthStateError("The sign-in state did not match.");
  }

  const record = await input.repository.findOAuthStateByHash(
    await stateHash(input.queryState, input.config),
  );
  if (!record) {
    throw new OAuthStateError("The sign-in state was invalid.");
  }
  if (record.usedAt) {
    throw new OAuthStateError("The sign-in state was already used.");
  }
  if (Date.parse(record.expiresAt) <= Date.now()) {
    throw new OAuthStateError("The sign-in state expired.");
  }

  await input.repository.markOAuthStateUsed(record.id);
  clearOAuthStateCookie(input.cookies);
  return safeReturnPath(record.returnPath);
}
