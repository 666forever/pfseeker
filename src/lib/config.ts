const DEFAULT_SITE_URL = "https://pfseeker.com";

export function normalizeSiteUrl(value: string | undefined): string {
  const siteUrl = value?.trim() || DEFAULT_SITE_URL;
  const parsed = new URL(siteUrl);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export const siteConfig = {
  name: "pfseeker",
  brandMark: ".pfseeker®",
  siteUrl: normalizeSiteUrl(import.meta.env.PUBLIC_SITE_URL),
  cloudinaryCloudName:
    import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "",
};
