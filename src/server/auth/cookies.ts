import type { AstroGlobal } from "astro";
import type { AuthConfig } from "@/server/config";

export const sessionCookieName = "pfseeker_session";
export const oauthStateCookieName = "pfseeker_oauth_state";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
export const oauthStateMaxAgeSeconds = 60 * 10;

export interface CookieJar {
  get(name: string): { value: string } | undefined;
  set: AstroGlobal["cookies"]["set"];
  delete: AstroGlobal["cookies"]["delete"];
}

export function sessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + sessionMaxAgeSeconds * 1000);
}

function secureCookie(config: Pick<AuthConfig, "isProduction">): boolean {
  return config.isProduction;
}

export function setSessionCookie(
  cookies: CookieJar,
  config: Pick<AuthConfig, "isProduction">,
  token: string,
): void {
  cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: secureCookie(config),
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export function clearSessionCookie(cookies: CookieJar): void {
  cookies.delete(sessionCookieName, { path: "/" });
}

export function setOAuthStateCookie(
  cookies: CookieJar,
  config: Pick<AuthConfig, "isProduction">,
  state: string,
): void {
  cookies.set(oauthStateCookieName, state, {
    httpOnly: true,
    secure: secureCookie(config),
    sameSite: "lax",
    path: "/auth/discord/callback",
    maxAge: oauthStateMaxAgeSeconds,
  });
}

export function clearOAuthStateCookie(cookies: CookieJar): void {
  cookies.delete(oauthStateCookieName, {
    path: "/auth/discord/callback",
  });
}
