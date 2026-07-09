/// <reference types="astro/client" />

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_CLOUDINARY_CLOUD_NAME?: string;
  readonly CLOUDINARY_CLOUD_NAME?: string;
  readonly CLOUDINARY_API_KEY?: string;
  readonly CLOUDINARY_API_SECRET?: string;
  readonly CLOUDINARY_PENDING_SUBMISSIONS_FOLDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
