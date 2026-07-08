import type { APIRoute } from "astro";
import {
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";
import { getContentRepository } from "@/server/repositories";
import { recordDownloadEvent } from "@/server/services/downloads";

interface DownloadBody {
  assetId?: unknown;
  source?: unknown;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: DownloadBody;

  try {
    body = (await request.json()) as DownloadBody;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  if (typeof body.assetId !== "string") {
    return json(400, { ok: false, error: "assetId must be a string." });
  }

  const source = typeof body.source === "string" ? body.source : undefined;

  try {
    const result = await recordDownloadEvent(
      await getContentRepository(locals),
      {
        assetId: body.assetId,
        source: source === "preview" || source === "original" ? source : "api",
      },
    );

    return json(201, { ok: true, download: result });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return json(404, { ok: false, error: error.message });
    }
    if (error instanceof InvalidRepositoryInputError) {
      return json(400, { ok: false, error: error.message });
    }
    return json(503, {
      ok: false,
      error: "Download recording is not available in this environment.",
    });
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "POST",
    },
  });
