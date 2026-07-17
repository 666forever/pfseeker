import type { AstroGlobal } from "astro";
import {
  getCloudflareRuntimeEnv,
  isCloudflarePagesRuntime,
} from "@/server/db/d1";
import { D1ContentRepository } from "@/server/repositories/d1";
import { createSeedRepository } from "@/server/repositories/seed";
import type { ContentRepository } from "@/server/repositories/types";

export function getContentRepository(
  locals: AstroGlobal["locals"],
): Promise<ContentRepository> {
  return createContentRepository(locals);
}

export async function createContentRepository(
  locals: AstroGlobal["locals"],
): Promise<ContentRepository> {
  const env = await getCloudflareRuntimeEnv(locals);

  if (env?.DB) {
    return new D1ContentRepository(env.DB, {
      cloudinaryCloudName:
        env.PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME,
    });
  }

  if (isCloudflarePagesRuntime(locals)) {
    throw new Error(
      "Cloudflare D1 binding DB is missing for the current Pages runtime.",
    );
  }

  return createSeedRepository();
}
