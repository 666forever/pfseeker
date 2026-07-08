import type { APIRoute } from "astro";
import { revokeCurrentSession } from "@/server/auth/session";

function redirectHome(): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/",
      "cache-control": "no-store",
    },
  });
}

export const POST: APIRoute = async ({ cookies, locals, request, url }) => {
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return new Response("Invalid logout origin.", {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  await revokeCurrentSession({ cookies, locals });
  return redirectHome();
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "POST",
      "cache-control": "no-store",
    },
  });
