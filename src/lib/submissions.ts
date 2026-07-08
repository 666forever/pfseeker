import { getCategoryForKind } from "@/data/categories";
import type { AssetKind } from "@/lib/media";

export const SUBMISSION_STATUS = "pending";
export const SUBMISSION_STATUS_LABEL = "Awaiting review";
export const PENDING_SUBMISSION_FOLDER = "pfseeker/pending-submissions";
export const UPLOAD_INTENT_EXPIRY_SECONDS = 10 * 60;
export const MAX_COMPLETED_SUBMISSIONS_PER_24_HOURS = 10;
export const MAX_ACTIVE_UPLOAD_INTENTS = 3;
export const MAX_PENDING_SUBMISSIONS = 50;
export const MAX_SELECTED_TAGS = 5;
export const MIN_SELECTED_TAGS = 1;
export const MAX_SUGGESTED_TAGS = 3;

export const allowedSubmissionFormats = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
] as const;

export type SubmissionFormat = (typeof allowedSubmissionFormats)[number];
export type SubmissionStatus = typeof SUBMISSION_STATUS;

export interface FileLimit {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
}

export const submissionFileLimits = {
  pfp: {
    minWidth: 256,
    minHeight: 256,
    maxWidth: 2048,
    maxHeight: 2048,
    maxBytes: 10 * 1024 * 1024,
  },
  banner: {
    minWidth: 256,
    minHeight: 256,
    maxWidth: 2048,
    maxHeight: 2048,
    maxBytes: 10 * 1024 * 1024,
  },
  icon: {
    minWidth: 20,
    minHeight: 20,
    maxWidth: 512,
    maxHeight: 512,
    maxBytes: 4 * 1024 * 1024,
  },
} satisfies Record<AssetKind, FileLimit>;

export interface SubmissionMetadata {
  assetType: AssetKind;
  title: string;
  category: string;
  tags: string[];
  description: string | null;
  creatorCredit: string | null;
  sourceUrl: string | null;
  suggestedTags: string[];
  contentRulesConfirmed: true;
}

export interface SubmissionMetadataValidation {
  ok: true;
  metadata: SubmissionMetadata;
}

export interface SubmissionValidationError {
  ok: false;
  message: string;
  field?: string;
}

export type SubmissionMetadataResult =
  SubmissionMetadataValidation | SubmissionValidationError;

export interface VerifiedImageInput {
  format: string;
  bytes: number;
  width: number;
  height: number;
  frameCount?: number;
}

export function normalizeSubmissionText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function includesControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function optionalText(
  value: unknown,
  maxLength: number,
  label: string,
): { ok: true; value: string | null } | SubmissionValidationError {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${label} must be text.` };
  }
  if (includesControlCharacter(value)) {
    return {
      ok: false,
      message: `${label} cannot include control characters.`,
    };
  }
  const normalized = normalizeSubmissionText(value);
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > maxLength) {
    return {
      ok: false,
      message: `${label} must be ${maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: normalized };
}

function parseAssetType(value: unknown): AssetKind | undefined {
  return value === "pfp" || value === "banner" || value === "icon"
    ? value
    : undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "string")) {
      return value.map(normalizeSubmissionText).filter(Boolean);
    }
    return undefined;
  }
  if (typeof value === "string") {
    return value.split(",").map(normalizeSubmissionText).filter(Boolean);
  }
  return [];
}

export function isAllowedSubmissionFormat(
  value: string,
): value is SubmissionFormat {
  return allowedSubmissionFormats.includes(
    value.toLowerCase() as SubmissionFormat,
  );
}

export function validateSubmissionStatus(
  value: unknown,
): value is SubmissionStatus {
  return value === SUBMISSION_STATUS;
}

export function validateSourceUrl(
  value: unknown,
): { ok: true; value: string | null } | SubmissionValidationError {
  const normalized = optionalText(value, 2048, "Source URL");
  if (!normalized.ok || normalized.value === null) return normalized;

  let parsed: URL;
  try {
    parsed = new URL(normalized.value);
  } catch {
    return { ok: false, message: "Source URL must be a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "Source URL must use HTTP or HTTPS." };
  }
  parsed.hash = "";
  return { ok: true, value: parsed.toString() };
}

export function validateSubmissionMetadata(
  data: Record<string, unknown>,
  validTags: string[],
): SubmissionMetadataResult {
  const assetType = parseAssetType(data.assetType);
  if (!assetType) {
    return { ok: false, field: "assetType", message: "Choose an asset type." };
  }

  const title = optionalText(data.title, 80, "Title");
  if (!title.ok || !title.value) {
    return title.ok
      ? {
          ok: false,
          field: "title",
          message: "Title must be 2 to 80 characters.",
        }
      : { ...title, field: "title" };
  }
  if (title.value.length < 2) {
    return {
      ok: false,
      field: "title",
      message: "Title must be 2 to 80 characters.",
    };
  }

  const category =
    typeof data.category === "string"
      ? normalizeSubmissionText(data.category)
      : "";
  if (!category || !getCategoryForKind(assetType, category)) {
    return {
      ok: false,
      field: "category",
      message: "Choose a category that matches the asset type.",
    };
  }

  const tags = normalizeStringList(data.tags);
  if (!tags) {
    return { ok: false, field: "tags", message: "Tags must be text values." };
  }
  const uniqueTags = Array.from(new Set(tags));
  const allowedTags = new Set(validTags);
  if (
    uniqueTags.length < MIN_SELECTED_TAGS ||
    uniqueTags.length > MAX_SELECTED_TAGS
  ) {
    return {
      ok: false,
      field: "tags",
      message: "Choose 1 to 5 existing tags.",
    };
  }
  if (!uniqueTags.every((tag) => allowedTags.has(tag))) {
    return {
      ok: false,
      field: "tags",
      message: "Choose only existing tags.",
    };
  }

  const description = optionalText(data.description, 100, "Description");
  if (!description.ok) return { ...description, field: "description" };
  const creatorCredit = optionalText(
    data.creatorCredit,
    80,
    "Creator or credit name",
  );
  if (!creatorCredit.ok) return { ...creatorCredit, field: "creatorCredit" };
  const sourceUrl = validateSourceUrl(data.sourceUrl);
  if (!sourceUrl.ok) return { ...sourceUrl, field: "sourceUrl" };

  const suggestedTags = normalizeStringList(data.suggestedTags);
  if (!suggestedTags) {
    return {
      ok: false,
      field: "suggestedTags",
      message: "Suggested tags must be text values.",
    };
  }
  const uniqueSuggestedTags = Array.from(new Set(suggestedTags));
  if (uniqueSuggestedTags.length > MAX_SUGGESTED_TAGS) {
    return {
      ok: false,
      field: "suggestedTags",
      message: "Suggest no more than 3 tags.",
    };
  }
  for (const tag of uniqueSuggestedTags) {
    if (includesControlCharacter(tag) || tag.length < 2 || tag.length > 30) {
      return {
        ok: false,
        field: "suggestedTags",
        message: "Suggested tags must be 2 to 30 characters.",
      };
    }
  }

  if (data.contentRulesConfirmed !== true) {
    return {
      ok: false,
      field: "contentRulesConfirmed",
      message: "Confirm the content rules before submitting.",
    };
  }

  return {
    ok: true,
    metadata: {
      assetType,
      title: title.value,
      category,
      tags: uniqueTags,
      description: description.value,
      creatorCredit: creatorCredit.value,
      sourceUrl: sourceUrl.value,
      suggestedTags: uniqueSuggestedTags,
      contentRulesConfirmed: true,
    },
  };
}

export function validateVerifiedImage(
  assetType: AssetKind,
  input: VerifiedImageInput,
): SubmissionValidationError | { ok: true; format: SubmissionFormat } {
  const format = input.format.toLowerCase();
  if (!isAllowedSubmissionFormat(format)) {
    return { ok: false, message: "Use JPG, JPEG, PNG, WebP, or GIF." };
  }

  const limits = submissionFileLimits[assetType];
  if (input.bytes > limits.maxBytes) {
    return {
      ok: false,
      message: "The image is too large for this asset type.",
    };
  }
  if (
    input.width < limits.minWidth ||
    input.height < limits.minHeight ||
    input.width > limits.maxWidth ||
    input.height > limits.maxHeight
  ) {
    return {
      ok: false,
      message: "The image dimensions are outside the allowed range.",
    };
  }

  const decodedWorkload =
    input.width * input.height * Math.max(1, input.frameCount ?? 1);
  if (format === "gif" && decodedWorkload > 2048 * 2048 * 100) {
    return {
      ok: false,
      message: "The GIF is too large or complex to process safely.",
    };
  }

  return { ok: true, format };
}

export function bytesLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}
