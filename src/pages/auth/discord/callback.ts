import type { APIRoute } from "astro";
import {
  clearOAuthStateCookie,
  oauthStateCookieName,
} from "@/server/auth/cookies";
import { exchangeDiscordCode, fetchDiscordUser } from "@/server/auth/discord";
import { consumeOAuthState, OAuthStateError } from "@/server/auth/oauth-state";
import { createUserSession } from "@/server/auth/session";
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

function errorRedirect(reason: string): Response {
  return redirect(`/auth/error?reason=${encodeURIComponent(reason)}`, 303);
}

export const GET: APIRoute = async ({ cookies, locals, url }) => {
  const discordError = url.searchParams.get("error");
  if (discordError) {
    clearOAuthStateCookie(cookies);
    return errorRedirect(
      discordError === "access_denied" ? "denied" : "discord",
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    clearOAuthStateCookie(cookies);
    return errorRedirect("missing-code");
  }

  try {
    const config = await getAuthConfig(locals);
    const repository = new AuthRepository(await getD1DatabaseAsync(locals));
    const returnPath = await consumeOAuthState({
      repository,
      config,
      queryState: url.searchParams.get("state"),
      cookieState: cookies.get(oauthStateCookieName)?.value,
      cookies,
    });
    const accessToken = await exchangeDiscordCode(config, code);
    const profile = await fetchDiscordUser(accessToken);
    const user = await repository.upsertDiscordUser(profile);
    await createUserSession({ repository, user, config, cookies });

    return redirect(returnPath || "/account", 303);
  } catch (error) {
    clearOAuthStateCookie(cookies);
    if (error instanceof OAuthStateError) return errorRedirect("state");
    if (error instanceof ServerConfigError)
      return errorRedirect("configuration");
    return errorRedirect("discord");
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
