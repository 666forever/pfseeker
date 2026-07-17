import type { APIContext, AstroGlobal } from "astro";
import type { AssetKind } from "@/lib/media";
import {
  PENDING_SUBMISSION_FOLDER,
  UPLOAD_INTENT_EXPIRY_SECONDS,
  validateVerifiedImage,
  type SubmissionFormat,
} from "@/lib/submissions";
import { getCloudflareRuntimeEnv } from "@/server/db/d1";
import { InvalidRepositoryInputError } from "@/server/repositories/errors";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  pendingFolder: string;
}

export interface SignedUploadParameters {
  cloudName: string;
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  publicId: string;
  overwrite: "false";
  context: string;
  signature: string;
  expiresAt: string;
}

interface CloudinaryResource {
  public_id: string;
  resource_type: string;
  type: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  secure_url?: string;
  url?: string;
  created_at?: string;
  context?: {
    custom?: Record<string, string>;
  };
}

export interface VerifiedCloudinaryUpload {
  publicId: string;
  resourceType: "image";
  format: SubmissionFormat;
  bytes: number;
  width: number;
  height: number;
  contentHash: string;
}

export class CloudinaryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudinaryConfigError";
  }
}

function readImportMetaEnv(key: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key]?.trim() ?? "";
}

function sanitizeFolder(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}

export async function getCloudinaryConfig(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): Promise<CloudinaryConfig> {
  const runtimeEnv = await getCloudflareRuntimeEnv(locals);
  const cloudName =
    runtimeEnv.CLOUDINARY_CLOUD_NAME ??
    runtimeEnv.PUBLIC_CLOUDINARY_CLOUD_NAME ??
    readImportMetaEnv("CLOUDINARY_CLOUD_NAME") ??
    readImportMetaEnv("PUBLIC_CLOUDINARY_CLOUD_NAME");
  const apiKey =
    runtimeEnv.CLOUDINARY_API_KEY ?? readImportMetaEnv("CLOUDINARY_API_KEY");
  const apiSecret =
    runtimeEnv.CLOUDINARY_API_SECRET ??
    readImportMetaEnv("CLOUDINARY_API_SECRET");
  const pendingFolder = sanitizeFolder(
    runtimeEnv.CLOUDINARY_PENDING_SUBMISSIONS_FOLDER ??
      readImportMetaEnv("CLOUDINARY_PENDING_SUBMISSIONS_FOLDER") ??
      PENDING_SUBMISSION_FOLDER,
  );

  if (!cloudName)
    throw new CloudinaryConfigError("Cloudinary cloud name is required.");
  if (!apiKey)
    throw new CloudinaryConfigError("Cloudinary API key is required.");
  if (!apiSecret) {
    throw new CloudinaryConfigError("Cloudinary API secret is required.");
  }
  if (
    !pendingFolder ||
    pendingFolder.includes("..") ||
    pendingFolder.includes("\\")
  ) {
    throw new CloudinaryConfigError("Cloudinary pending folder is invalid.");
  }

  return { cloudName, apiKey, apiSecret, pendingFolder };
}

function encodePublicIdForResourcePath(publicId: string): string {
  return publicId.split("/").map(encodeURIComponent).join("/");
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createPendingPublicId(input: {
  userId: string;
  intentId: string;
  folder: string;
}): string {
  const random = crypto.randomUUID().replaceAll("-", "");
  return `${input.folder}/${input.userId}/${input.intentId}/${random}`;
}

export function publicIdInPendingNamespace(
  publicId: string,
  folder = PENDING_SUBMISSION_FOLDER,
): boolean {
  const normalizedFolder = sanitizeFolder(folder);
  return (
    publicId.startsWith(`${normalizedFolder}/`) &&
    !publicId.includes("..") &&
    !publicId.includes("\\") &&
    !/https?:/i.test(publicId)
  );
}

export function createPublishedPublicId(input: {
  assetType: AssetKind;
  assetId: string;
}): string {
  return `pfseeker/published/${input.assetType}/${input.assetId}`;
}

export function publicIdInPublishedNamespace(publicId: string): boolean {
  return (
    publicId.startsWith("pfseeker/published/") &&
    !publicId.includes("..") &&
    !publicId.includes("\\") &&
    !/https?:/i.test(publicId)
  );
}

async function signParameters(
  params: Record<string, string | number>,
  apiSecret: string,
): Promise<string> {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return sha1Hex(`${payload}${apiSecret}`);
}

export async function createSignedUploadParameters(input: {
  config: CloudinaryConfig;
  publicId: string;
  intentId: string;
  expiresAt: string;
}): Promise<SignedUploadParameters> {
  const timestamp = Math.floor(Date.now() / 1000);
  const context = `pfseeker_intent_id=${input.intentId}`;
  const signature = await signParameters(
    {
      context,
      overwrite: "false",
      public_id: input.publicId,
      timestamp,
    },
    input.config.apiSecret,
  );

  return {
    cloudName: input.config.cloudName,
    uploadUrl: `https://api.cloudinary.com/v1_1/${input.config.cloudName}/image/upload`,
    apiKey: input.config.apiKey,
    timestamp,
    publicId: input.publicId,
    overwrite: "false",
    context,
    signature,
    expiresAt: input.expiresAt,
  };
}

function authHeader(config: CloudinaryConfig): string {
  return `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`;
}

export async function readCloudinaryResource(
  config: CloudinaryConfig,
  publicId: string,
): Promise<CloudinaryResource> {
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${encodePublicIdForResourcePath(publicId)}`,
    {
      headers: { authorization: authHeader(config) },
    },
  );
  if (!response.ok) {
    throw new InvalidRepositoryInputError(
      "Uploaded image could not be verified.",
    );
  }
  return (await response.json()) as CloudinaryResource;
}

export async function deleteCloudinaryResource(
  config: CloudinaryConfig,
  publicId: string,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signParameters(
    { public_id: publicId, timestamp },
    config.apiSecret,
  );
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
    { method: "POST", body },
  );
  if (!response.ok) {
    throw new InvalidRepositoryInputError(
      "Cloudinary image could not be deleted.",
    );
  }
}

export async function copyCloudinaryResource(input: {
  config: CloudinaryConfig;
  sourcePublicId: string;
  targetPublicId: string;
}): Promise<void> {
  if (
    !publicIdInPendingNamespace(
      input.sourcePublicId,
      input.config.pendingFolder,
    ) ||
    !publicIdInPublishedNamespace(input.targetPublicId)
  ) {
    throw new InvalidRepositoryInputError(
      "Cloudinary copy namespace is invalid.",
    );
  }

  const source = await readCloudinaryResource(
    input.config,
    input.sourcePublicId,
  );
  if (
    source.public_id !== input.sourcePublicId ||
    source.resource_type !== "image" ||
    source.type !== "upload"
  ) {
    throw new InvalidRepositoryInputError(
      "Cloudinary source image could not be copied.",
    );
  }
  const sourceUrl = source.secure_url ?? source.url;
  if (!sourceUrl) {
    throw new InvalidRepositoryInputError(
      "Cloudinary source image URL is missing.",
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signParameters(
    {
      file: sourceUrl,
      overwrite: "false",
      public_id: input.targetPublicId,
      timestamp,
    },
    input.config.apiSecret,
  );
  const body = new URLSearchParams({
    file: sourceUrl,
    overwrite: "false",
    public_id: input.targetPublicId,
    timestamp: String(timestamp),
    api_key: input.config.apiKey,
    signature,
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${input.config.cloudName}/image/upload`,
    { method: "POST", body },
  );
  if (!response.ok) {
    throw new InvalidRepositoryInputError(
      "Cloudinary image could not be copied for publication.",
    );
  }
}

async function hashUploadedBytes(
  resource: CloudinaryResource,
): Promise<string> {
  const url = resource.secure_url ?? resource.url;
  if (!url) {
    throw new InvalidRepositoryInputError("Verified image URL is missing.");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new InvalidRepositoryInputError(
      "Verified image bytes could not be read.",
    );
  }
  const buffer = await response.arrayBuffer();
  return sha256Hex(buffer);
}

export async function verifyCloudinaryUpload(input: {
  config: CloudinaryConfig;
  publicId: string;
  intentId: string;
  assetType: AssetKind;
}): Promise<VerifiedCloudinaryUpload> {
  if (!publicIdInPendingNamespace(input.publicId, input.config.pendingFolder)) {
    throw new InvalidRepositoryInputError(
      "Uploaded image is outside the pending namespace.",
    );
  }

  const resource = await readCloudinaryResource(input.config, input.publicId);
  if (resource.public_id !== input.publicId) {
    throw new InvalidRepositoryInputError("Cloudinary public ID mismatch.");
  }
  if (resource.resource_type !== "image" || resource.type !== "upload") {
    throw new InvalidRepositoryInputError(
      "Uploaded file is not a standard image upload.",
    );
  }
  if (resource.context?.custom?.pfseeker_intent_id !== input.intentId) {
    throw new InvalidRepositoryInputError(
      "Uploaded image does not match its intent.",
    );
  }

  const image = validateVerifiedImage(input.assetType, {
    format: resource.format,
    bytes: resource.bytes,
    width: resource.width,
    height: resource.height,
  });
  if (!image.ok) throw new InvalidRepositoryInputError(image.message);

  return {
    publicId: resource.public_id,
    resourceType: "image",
    format: image.format,
    bytes: resource.bytes,
    width: resource.width,
    height: resource.height,
    contentHash: await hashUploadedBytes(resource),
  };
}

export function uploadIntentExpiresAt(
  seconds = UPLOAD_INTENT_EXPIRY_SECONDS,
): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
