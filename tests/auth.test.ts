import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildDiscordAuthorizationUrl,
  discordAvatarUrl,
  mapDiscordUser,
} from "@/server/auth/discord";
import { safeReturnPath } from "@/server/auth/redirects";
import { hmacSha256, randomToken } from "@/server/auth/crypto";
import {
  clearSessionCookie,
  sessionCookieName,
  sessionMaxAgeSeconds,
  setSessionCookie,
} from "@/server/auth/cookies";
import { getAuthConfig, ServerConfigError } from "@/server/config";

class CookieRecorder {
  values = new Map<
    string,
    { value: string; options: Record<string, unknown> }
  >();
  deleted = new Set<string>();

  get(name: string): { value: string } | undefined {
    return this.values.get(name);
  }

  set(name: string, value: string, options: Record<string, unknown>): void {
    this.values.set(name, { value, options });
  }

  delete(name: string): void {
    this.deleted.add(name);
  }
}

describe("auth migration", () => {
  it("adds users, sessions, oauth states, and indexes without roles or email", () => {
    const migration = readFileSync(
      "migrations/0002_auth_and_sessions.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(migration).toContain("discord_user_id TEXT NOT NULL UNIQUE");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(migration).toContain("token_hash TEXT NOT NULL UNIQUE");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS oauth_states");
    expect(migration).toContain("idx_sessions_token_hash");
    expect(migration).toContain("FOREIGN KEY (user_id) REFERENCES users(id)");
    expect(migration).not.toMatch(/\bemail\b/i);
    expect(migration).not.toMatch(/\bpassword\b/i);
    expect(migration).not.toMatch(/\badmin\b/i);
    expect(migration).not.toMatch(/\bguild\b/i);
  });
});

describe("safe return paths", () => {
  it("allows same-origin relative paths", () => {
    expect(safeReturnPath("/account")).toBe("/account");
    expect(safeReturnPath("/search?tag=ridge")).toBe("/search?tag=ridge");
  });

  it("rejects external, protocol-relative, backslash, and callback targets", () => {
    expect(safeReturnPath("https://evil.example/account")).toBe("/account");
    expect(safeReturnPath("//evil.example/account")).toBe("/account");
    expect(safeReturnPath("/\\evil")).toBe("/account");
    expect(safeReturnPath("/auth/discord/callback?x=1")).toBe("/account");
    expect(safeReturnPath("%2f%2fevil.example")).toBe("/account");
  });
});

describe("Discord OAuth helpers", () => {
  it("builds an identify-only authorization URL without secrets", () => {
    const url = new URL(
      buildDiscordAuthorizationUrl(
        {
          discordClientId: "1523444161951437050",
          discordRedirectUri: "http://localhost:4321/auth/discord/callback",
        },
        "state-value",
      ),
    );

    expect(url.origin).toBe("https://discord.com");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.toString()).not.toContain("secret");
  });

  it("maps identify user fields only", () => {
    expect(
      mapDiscordUser({
        id: "1523444161951437050",
        username: "pfseeker",
        global_name: "pfseeker user",
        avatar: "abc",
      }),
    ).toEqual({
      id: "1523444161951437050",
      username: "pfseeker",
      globalName: "pfseeker user",
      avatarHash: "abc",
    });
  });

  it("builds custom and default avatar URLs", () => {
    expect(
      discordAvatarUrl({
        discordUserId: "1523444161951437050",
        avatarHash: "a_animated",
      }),
    ).toContain(".gif?size=128");
    expect(
      discordAvatarUrl({
        discordUserId: "1523444161951437050",
        avatarHash: null,
      }),
    ).toMatch(/\/embed\/avatars\/\d\.png$/);
  });
});

describe("session primitives", () => {
  it("generates random opaque session tokens", () => {
    const first = randomToken();
    const second = randomToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes session tokens without returning the raw token", async () => {
    const hash = await hmacSha256("session:token", "x".repeat(40));

    expect(hash).not.toContain("token");
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("serializes local and production session cookies safely", () => {
    const localCookies = new CookieRecorder();
    setSessionCookie(localCookies, { isProduction: false }, "token");
    expect(localCookies.values.get(sessionCookieName)?.options).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAgeSeconds,
    });

    const productionCookies = new CookieRecorder();
    setSessionCookie(productionCookies, { isProduction: true }, "token");
    expect(
      productionCookies.values.get(sessionCookieName)?.options,
    ).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    clearSessionCookie(productionCookies);
    expect(productionCookies.deleted.has(sessionCookieName)).toBe(true);
  });
});

describe("auth configuration", () => {
  const baseEnv = {
    CF_PAGES: "1",
    DISCORD_CLIENT_ID: "1523444161951437050",
    DISCORD_CLIENT_SECRET: "super-secret-client-value",
    DISCORD_REDIRECT_URI: "https://pfseeker.com/auth/discord/callback",
    SESSION_SECRET: "x".repeat(40),
    PUBLIC_SITE_URL: "https://pfseeker.com",
  };
  const localsFor = (
    env: Record<string, string>,
  ): Parameters<typeof getAuthConfig>[0] =>
    ({ runtime: { env } }) as unknown as Parameters<typeof getAuthConfig>[0];

  it("validates the approved production Discord configuration", async () => {
    const config = await getAuthConfig(localsFor(baseEnv));

    expect(config.discordClientId).toBe("1523444161951437050");
    expect(config.discordRedirectUri).toBe(
      "https://pfseeker.com/auth/discord/callback",
    );
    expect(config.isProduction).toBe(true);
  });

  it("rejects invalid client IDs and short session secrets without leaking values", async () => {
    await expect(
      getAuthConfig(
        localsFor({
          ...baseEnv,
          DISCORD_CLIENT_ID: "not-a-snowflake",
          SESSION_SECRET: "short-secret-value",
        }),
      ),
    ).rejects.toThrow(ServerConfigError);

    await expect(
      getAuthConfig(
        localsFor({
          ...baseEnv,
          DISCORD_CLIENT_SECRET: "do-not-leak-client-secret",
          SESSION_SECRET: "short-secret-value",
        }),
      ),
    ).rejects.not.toThrow("do-not-leak-client-secret");
  });

  it("accepts localhost callback paths and rejects non-callback redirects", async () => {
    await expect(
      getAuthConfig(
        localsFor({
          ...baseEnv,
          DISCORD_REDIRECT_URI: "http://localhost:4321/auth/discord/callback",
        }),
      ),
    ).resolves.toMatchObject({ isProduction: false });

    await expect(
      getAuthConfig(
        localsFor({
          ...baseEnv,
          DISCORD_REDIRECT_URI: "https://pfseeker.com/not-the-callback",
        }),
      ),
    ).rejects.toThrow("/auth/discord/callback");
  });
});

describe("client source boundary", () => {
  it("does not put auth secrets or server auth imports in browser scripts", () => {
    const scriptFiles = [
      "src/scripts/primitives.ts",
      "src/scripts/detail-actions.ts",
      "src/scripts/collection-client.ts",
    ];
    const combined = scriptFiles
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(combined).not.toMatch(/DISCORD_CLIENT_SECRET|SESSION_SECRET/);
    expect(combined).not.toMatch(/@\/server\/(auth|config|repositories)/);
  });
});
