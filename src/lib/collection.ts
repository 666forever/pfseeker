export const MAX_COLLECTION_NAME_LENGTH = 80;
export const DEFAULT_COLLECTION_VISIBILITY = "private";

export type CollectionVisibility = "private";

export interface CollectionNameResult {
  ok: true;
  name: string;
}

export interface CollectionNameError {
  ok: false;
  message: string;
}

export type CollectionNameValidation =
  CollectionNameResult | CollectionNameError;

export interface ReorderValidationResult {
  ok: true;
  assetIds: string[];
}

export interface ReorderValidationError {
  ok: false;
  message: string;
}

export type ReorderValidation =
  ReorderValidationResult | ReorderValidationError;

export function normalizeCollectionName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function includesControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function validateCollectionName(
  value: unknown,
): CollectionNameValidation {
  if (typeof value !== "string") {
    return { ok: false, message: "Collection name is required." };
  }

  if (includesControlCharacter(value)) {
    return {
      ok: false,
      message: "Collection names cannot include control characters.",
    };
  }

  const name = normalizeCollectionName(value);

  if (!name) {
    return { ok: false, message: "Collection name cannot be empty." };
  }

  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
    return {
      ok: false,
      message: `Collection name must be ${MAX_COLLECTION_NAME_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, name };
}

export function safeCollectionDownloadName(name: string): string {
  return (
    normalizeCollectionName(name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^\.+/, "")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "collection"
  );
}

export function validateReorderPayload(
  currentAssetIds: string[],
  requestedAssetIds: unknown,
): ReorderValidation {
  if (!Array.isArray(requestedAssetIds)) {
    return { ok: false, message: "Reorder payload must include asset IDs." };
  }

  const normalized = requestedAssetIds.filter(
    (assetId): assetId is string => typeof assetId === "string",
  );

  if (normalized.length !== requestedAssetIds.length) {
    return { ok: false, message: "Reorder payload contains invalid IDs." };
  }

  const requested = new Set(normalized);
  if (requested.size !== normalized.length) {
    return { ok: false, message: "Reorder payload contains duplicate IDs." };
  }

  const current = new Set(currentAssetIds);
  if (requested.size !== current.size) {
    return {
      ok: false,
      message:
        "Reorder payload must contain every collection item exactly once.",
    };
  }

  for (const assetId of normalized) {
    if (!current.has(assetId)) {
      return {
        ok: false,
        message: "Reorder payload includes an item outside this collection.",
      };
    }
  }

  return { ok: true, assetIds: normalized };
}
