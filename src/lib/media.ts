import { siteConfig } from "@/lib/config";

export type AssetKind = "pfp" | "banner" | "icon";
export type MediaFormat = "avif" | "gif" | "jpg" | "png" | "svg" | "webp";
export type AnimationState = "animated" | "static";
export type CloudinaryCrop =
  "crop" | "fill" | "fit" | "limit" | "scale" | "thumb";
export type CloudinaryGravity =
  "auto" | "center" | "east" | "face" | "faces" | "north" | "south" | "west";
export type CloudinaryQuality = "auto" | number;
export type CloudinaryFormat = "auto" | MediaFormat;

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface PfseekerMediaAsset extends MediaDimensions {
  kind: AssetKind;
  publicId: string;
  alt: string;
  format?: MediaFormat;
  animation?: AnimationState;
  version?: number;
}

export interface LocalMediaAsset extends MediaDimensions {
  kind: AssetKind;
  localSrc: string;
  alt: string;
  format?: MediaFormat;
  animation?: AnimationState;
}

export interface CloudinaryConfig {
  cloudName: string;
}

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: CloudinaryCrop;
  gravity?: CloudinaryGravity;
  dpr?: "auto" | number;
  quality?: CloudinaryQuality;
  format?: CloudinaryFormat;
  flags?: string[];
  page?: number;
  effect?: string;
}

export interface CloudinaryImageOptions extends CloudinaryTransformOptions {
  cloudName?: string;
  publicId: string;
  version?: number;
}

export interface ResponsiveImageOptions {
  cloudName?: string;
  preset?: AssetKind;
  widths?: number[];
  sizes?: string;
  quality?: CloudinaryQuality;
  format?: CloudinaryFormat;
}

export interface LocalResponsiveImageOptions {
  preset?: AssetKind;
  widths?: number[];
  sizes?: string;
}

export interface ResponsiveImageDescriptor extends MediaDimensions {
  src: string;
  srcset: string;
  sizes: string;
  alt: string;
  aspectRatio: string;
  placeholder: string;
  downloadUrl: string;
}

const CLOUDINARY_IMAGE_BASE = "https://res.cloudinary.com";
const DEFAULT_WIDTHS: Record<AssetKind, number[]> = {
  pfp: [160, 320, 480, 640],
  banner: [640, 960, 1280, 1600],
  icon: [96, 160, 256, 384],
};
const DEFAULT_SIZES: Record<AssetKind, string> = {
  pfp: "(min-width: 960px) 320px, 50vw",
  banner: "(min-width: 960px) 960px, 100vw",
  icon: "(min-width: 720px) 160px, 33vw",
};
const PRESET_TRANSFORMS: Record<AssetKind, CloudinaryTransformOptions> = {
  pfp: { crop: "fill", gravity: "auto" },
  banner: { crop: "fill", gravity: "auto" },
  icon: { crop: "fit" },
};

function positiveInteger(value: number, name: string, max?: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  if (max !== undefined && value > max) {
    throw new Error(`${name} must be ${max} or less.`);
  }

  return value;
}

function safeTransformationToken(value: string, name: string): string {
  if (!/^[a-zA-Z0-9:._-]+$/.test(value)) {
    throw new Error(`${name} contains unsupported characters.`);
  }

  return value;
}

function cleanCloudName(cloudName = siteConfig.cloudinaryCloudName): string {
  const normalized = cloudName.trim();

  if (!normalized) {
    throw new Error("PUBLIC_CLOUDINARY_CLOUD_NAME is required for media URLs.");
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error("Cloudinary cloud name contains unsupported characters.");
  }

  return normalized;
}

export function getPublicCloudinaryConfig(
  env: Pick<ImportMetaEnv, "PUBLIC_CLOUDINARY_CLOUD_NAME"> = import.meta.env,
): CloudinaryConfig {
  return {
    cloudName: cleanCloudName(env.PUBLIC_CLOUDINARY_CLOUD_NAME),
  };
}

export function encodeCloudinaryPublicId(publicId: string): string {
  const trimmed = publicId.trim();

  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Cloudinary public ID must be a relative, non-empty path.");
  }

  return trimmed.split("/").map(encodeURIComponent).join("/");
}

export function buildCloudinaryTransform(
  options: CloudinaryTransformOptions = {},
): string {
  const parts: string[] = [];

  if (options.quality !== undefined) {
    parts.push(
      options.quality === "auto"
        ? "q_auto"
        : `q_${positiveInteger(options.quality, "quality", 100)}`,
    );
  }

  if (options.format) {
    parts.push(`f_${options.format}`);
  }

  if (options.width !== undefined) {
    parts.push(`w_${positiveInteger(options.width, "width")}`);
  }

  if (options.height !== undefined) {
    parts.push(`h_${positiveInteger(options.height, "height")}`);
  }

  if (options.crop) {
    parts.push(`c_${options.crop}`);
  }

  if (options.gravity) {
    parts.push(`g_${options.gravity}`);
  }

  if (options.dpr !== undefined) {
    parts.push(
      options.dpr === "auto"
        ? "dpr_auto"
        : `dpr_${positiveInteger(options.dpr, "dpr")}`,
    );
  }

  if (options.page !== undefined) {
    parts.push(`pg_${positiveInteger(options.page, "page")}`);
  }

  if (options.effect) {
    parts.push(`e_${safeTransformationToken(options.effect, "effect")}`);
  }

  if (options.flags?.length) {
    parts.push(
      ...options.flags.map(
        (flag) => `fl_${safeTransformationToken(flag, "flag")}`,
      ),
    );
  }

  return parts.join(",");
}

export function buildCloudinaryImageUrl(
  options: CloudinaryImageOptions,
): string {
  const cloudName = cleanCloudName(options.cloudName);
  const transform = buildCloudinaryTransform(options);
  const version = options.version
    ? `v${positiveInteger(options.version, "version")}/`
    : "";
  const path = encodeCloudinaryPublicId(options.publicId);
  const transformSegment = transform ? `${transform}/` : "";

  return `${CLOUDINARY_IMAGE_BASE}/${cloudName}/image/upload/${transformSegment}${version}${path}`;
}

export function mediaPresetTransform(
  kind: AssetKind,
  options: CloudinaryTransformOptions = {},
): CloudinaryTransformOptions {
  return {
    quality: "auto",
    format: "auto",
    ...PRESET_TRANSFORMS[kind],
    ...options,
  };
}

export function buildMediaPreviewUrl(
  media: PfseekerMediaAsset,
  options: CloudinaryTransformOptions & {
    cloudName?: string;
    preset?: AssetKind;
  } = {},
): string {
  const preset = mediaPresetTransform(options.preset ?? media.kind, options);

  return buildCloudinaryImageUrl({
    ...preset,
    cloudName: options.cloudName,
    publicId: media.publicId,
    version: media.version,
  });
}

export function buildOriginalDownloadUrl(
  media: PfseekerMediaAsset,
  options: { cloudName?: string; filename?: string } = {},
): string {
  const attachmentFlag = options.filename
    ? `attachment:${options.filename.replace(/[^a-zA-Z0-9._-]+/g, "-")}`
    : "attachment";

  return buildCloudinaryImageUrl({
    cloudName: options.cloudName,
    publicId: media.publicId,
    version: media.version,
    flags: [attachmentFlag],
  });
}

export function buildResponsiveImage(
  media: PfseekerMediaAsset,
  options: ResponsiveImageOptions = {},
): ResponsiveImageDescriptor {
  const preset = options.preset ?? media.kind;
  const widths = [...(options.widths ?? DEFAULT_WIDTHS[preset])]
    .map((width) => positiveInteger(width, "width"))
    .sort((a, b) => a - b);
  const largestWidth = widths.at(-1) ?? media.width;
  const transform = mediaPresetTransform(preset, {
    quality: options.quality ?? "auto",
    format: options.format ?? "auto",
  });

  const urlForWidth = (width: number) =>
    buildMediaPreviewUrl(media, {
      ...transform,
      cloudName: options.cloudName,
      width,
    });

  return {
    src: urlForWidth(largestWidth),
    srcset: widths.map((width) => `${urlForWidth(width)} ${width}w`).join(", "),
    sizes: options.sizes ?? DEFAULT_SIZES[preset],
    alt: media.alt,
    width: media.width,
    height: media.height,
    aspectRatio: `${media.width} / ${media.height}`,
    placeholder: buildMediaPreviewUrl(media, {
      ...transform,
      cloudName: options.cloudName,
      width: 32,
      quality: 30,
      effect: "blur:1000",
    }),
    downloadUrl: buildOriginalDownloadUrl(media, {
      cloudName: options.cloudName,
    }),
  };
}

export function buildLocalResponsiveImage(
  media: LocalMediaAsset,
  options: LocalResponsiveImageOptions = {},
): ResponsiveImageDescriptor {
  const preset = options.preset ?? media.kind;
  const widths = [...(options.widths ?? DEFAULT_WIDTHS[preset])]
    .map((width) => positiveInteger(width, "width"))
    .sort((a, b) => a - b);

  return {
    src: media.localSrc,
    srcset: widths.map((width) => `${media.localSrc} ${width}w`).join(", "),
    sizes: options.sizes ?? DEFAULT_SIZES[preset],
    alt: media.alt,
    width: media.width,
    height: media.height,
    aspectRatio: `${media.width} / ${media.height}`,
    placeholder: media.localSrc,
    downloadUrl: media.localSrc,
  };
}
