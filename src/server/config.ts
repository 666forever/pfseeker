import type { APIContext, AstroGlobal } from "astro";
import { getCloudflareRuntimeEnv } from "@/server/db/d1";

const DISCORD_CLIENT_ID_PATTERN = /^\d{17,20}$/;
const EXPECTED_DISCORD_CLIENT_ID = "1523444161951437050";
const MIN_SESSION_SECRET_LENGTH = 32;

export interface AuthConfig {
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  sessionSecret: string;
  publicSiteUrl: string;
  isProduction: boolean;
}

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigError";
  }
}

function readImportMetaEnv(key: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key]?.trim() ?? "";
}

function normalizePublicSiteUrl(value: string): string {
  const parsed = new URL(value || "https://pfseeker.com");
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function assertHttpUrl(value: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ServerConfigError(`${label} must be a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ServerConfigError(`${label} must use HTTP or HTTPS.`);
  }

  return parsed;
}

export async function getAuthConfig(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): Promise<AuthConfig> {
  const runtimeEnv = await getCloudflareRuntimeEnv(locals);
  const publicSiteUrl = normalizePublicSiteUrl(
    runtimeEnv.PUBLIC_SITE_URL ??
      readImportMetaEnv("PUBLIC_SITE_URL") ??
      "https://pfseeker.com",
  );
  const discordClientId =
    runtimeEnv.DISCORD_CLIENT_ID ?? readImportMetaEnv("DISCORD_CLIENT_ID");
  const discordClientSecret =
    runtimeEnv.DISCORD_CLIENT_SECRET ??
    readImportMetaEnv("DISCORD_CLIENT_SECRET");
  const discordRedirectUri =
    runtimeEnv.DISCORD_REDIRECT_URI ??
    readImportMetaEnv("DISCORD_REDIRECT_URI");
  const sessionSecret =
    runtimeEnv.SESSION_SECRET ?? readImportMetaEnv("SESSION_SECRET");

  if (!DISCORD_CLIENT_ID_PATTERN.test(discordClientId)) {
    throw new ServerConfigError(
      "DISCORD_CLIENT_ID must be a Discord snowflake.",
    );
  }
  if (discordClientId !== EXPECTED_DISCORD_CLIENT_ID) {
    throw new ServerConfigError("DISCORD_CLIENT_ID does not match pfseeker.");
  }
  if (!discordClientSecret) {
    throw new ServerConfigError("DISCORD_CLIENT_SECRET is required.");
  }
  if (!sessionSecret || sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new ServerConfigError(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  const redirectUrl = assertHttpUrl(discordRedirectUri, "DISCORD_REDIRECT_URI");
  assertHttpUrl(publicSiteUrl, "PUBLIC_SITE_URL");
  const isProduction =
    redirectUrl.protocol === "https:" &&
    redirectUrl.hostname === "pfseeker.com";

  if (isProduction && redirectUrl.protocol !== "https:") {
    throw new ServerConfigError(
      "Production DISCORD_REDIRECT_URI must use HTTPS.",
    );
  }
  if (redirectUrl.pathname !== "/auth/discord/callback") {
    throw new ServerConfigError(
      "DISCORD_REDIRECT_URI must point to /auth/discord/callback.",
    );
  }

  return {
    discordClientId,
    discordClientSecret,
    discordRedirectUri: redirectUrl.toString(),
    sessionSecret,
    publicSiteUrl,
    isProduction,
  };
}
