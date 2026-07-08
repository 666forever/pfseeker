import type { AuthConfig } from "@/server/config";
import type { DiscordUserProfile } from "@/server/auth/types";

const discordApiBase = "https://discord.com/api/v10";
const discordCdnBase = "https://cdn.discordapp.com";

interface DiscordTokenResponse {
  access_token?: unknown;
  token_type?: unknown;
  scope?: unknown;
}

interface DiscordUserResponse {
  id?: unknown;
  username?: unknown;
  global_name?: unknown;
  avatar?: unknown;
}

export class DiscordOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordOAuthError";
  }
}

export function buildDiscordAuthorizationUrl(
  config: Pick<AuthConfig, "discordClientId" | "discordRedirectUri">,
  state: string,
): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.discordClientId);
  url.searchParams.set("redirect_uri", config.discordRedirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeDiscordCode(
  config: AuthConfig,
  code: string,
): Promise<string> {
  const form = new URLSearchParams({
    client_id: config.discordClientId,
    client_secret: config.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.discordRedirectUri,
  });

  const response = await fetch(`${discordApiBase}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!response.ok) {
    throw new DiscordOAuthError("Discord token exchange failed.");
  }

  const token = (await response.json()) as DiscordTokenResponse;
  if (
    token.token_type !== "Bearer" ||
    typeof token.access_token !== "string" ||
    typeof token.scope !== "string" ||
    !token.scope.split(/\s+/).includes("identify")
  ) {
    throw new DiscordOAuthError("Discord token response was invalid.");
  }

  return token.access_token;
}

export function mapDiscordUser(
  response: DiscordUserResponse,
): DiscordUserProfile {
  if (typeof response.id !== "string" || !/^\d{17,20}$/.test(response.id)) {
    throw new DiscordOAuthError("Discord user response was missing an ID.");
  }
  if (typeof response.username !== "string" || !response.username.trim()) {
    throw new DiscordOAuthError(
      "Discord user response was missing a username.",
    );
  }

  return {
    id: response.id,
    username: response.username,
    globalName:
      typeof response.global_name === "string" && response.global_name.trim()
        ? response.global_name
        : null,
    avatarHash:
      typeof response.avatar === "string" && response.avatar.trim()
        ? response.avatar
        : null,
  };
}

export async function fetchDiscordUser(
  accessToken: string,
): Promise<DiscordUserProfile> {
  const response = await fetch(`${discordApiBase}/users/@me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new DiscordOAuthError("Discord user request failed.");
  }

  return mapDiscordUser((await response.json()) as DiscordUserResponse);
}

export function discordAvatarUrl(user: {
  discordUserId: string;
  avatarHash: string | null;
}): string {
  if (user.avatarHash) {
    const extension = user.avatarHash.startsWith("a_") ? "gif" : "png";
    return `${discordCdnBase}/avatars/${user.discordUserId}/${user.avatarHash}.${extension}?size=128`;
  }

  const defaultIndex = Number((BigInt(user.discordUserId) >> 22n) % 6n);
  return `${discordCdnBase}/embed/avatars/${defaultIndex}.png`;
}
