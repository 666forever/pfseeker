import type { APIRoute } from "astro";
import {
  oauthStateCookieName,
  setOAuthStateCookie,
} from "@/server/auth/cookies";
import { buildDiscordAuthorizationUrl } from "@/server/auth/discord";
import { createOAuthState } from "@/server/auth/oauth-state";
import { getAuthConfig, ServerConfigError } from "@/server/config";
import { getD1DatabaseAsync } from "@/server/db/d1";
import { AuthRepository } from "@/server/repositories/auth";

function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      location,
      "cache-control": "no-store",
    },
  });
}

export const GET: APIRoute = async ({ cookies, locals, url }) => {
  try {
    const config = await getAuthConfig(locals);
    const repository = new AuthRepository(await getD1DatabaseAsync(locals));
    const { state } = await createOAuthState({
      repository,
      config,
      returnTo: url.searchParams.get("returnTo"),
    });
    setOAuthStateCookie(cookies, config, state);

    return redirect(buildDiscordAuthorizationUrl(config, state));
  } catch (error) {
    const reason =
      error instanceof ServerConfigError ? "configuration" : "unavailable";
    cookies.delete(oauthStateCookieName, { path: "/auth/discord/callback" });
    return redirect(`/auth/error?reason=${reason}`, 303);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "GET",
      "cache-control": "no-store",
    },
  });
