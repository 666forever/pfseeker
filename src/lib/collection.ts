import { seedAssets, type SeedAsset } from "@/data/assets";

export const COLLECTION_STORAGE_KEY = "pfseeker.collection.v1";
export const COLLECTION_SCHEMA_VERSION = 1;
export const DEFAULT_COLLECTION_NAME = "Local collection";
export const MAX_COLLECTION_NAME_LENGTH = 64;

export interface CollectionState {
  version: typeof COLLECTION_SCHEMA_VERSION;
  name: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionLoadResult {
  state: CollectionState;
  warning?: string;
}

export interface ResolvedCollectionItem {
  id: string;
  asset?: SeedAsset;
  missing: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const assetIds = new Set(seedAssets.map((asset) => asset.id));

export function currentTimestamp(): string {
  return new Date().toISOString();
}

export function defaultCollectionState(
  now = currentTimestamp(),
): CollectionState {
  return {
    version: COLLECTION_SCHEMA_VERSION,
    name: DEFAULT_COLLECTION_NAME,
    assetIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizeCollectionName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_COLLECTION_NAME_LENGTH);
}

export function uniqueAssetIds(values: unknown[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string" || seen.has(value)) {
      continue;
    }

    seen.add(value);
    ids.push(value);
  }

  return ids;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function validateCollectionState(
  value: unknown,
): CollectionState | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Partial<CollectionState>;

  if (record.version !== COLLECTION_SCHEMA_VERSION) {
    return undefined;
  }

  if (!Array.isArray(record.assetIds)) {
    return undefined;
  }

  const name =
    typeof record.name === "string"
      ? sanitizeCollectionName(record.name)
      : DEFAULT_COLLECTION_NAME;

  if (!name) {
    return undefined;
  }

  return {
    version: COLLECTION_SCHEMA_VERSION,
    name,
    assetIds: uniqueAssetIds(record.assetIds),
    createdAt: isIsoDate(record.createdAt)
      ? record.createdAt
      : currentTimestamp(),
    updatedAt: isIsoDate(record.updatedAt)
      ? record.updatedAt
      : currentTimestamp(),
  };
}

export function parseStoredCollection(
  serialized: string | null,
  now = currentTimestamp(),
): CollectionLoadResult {
  if (!serialized) {
    return { state: defaultCollectionState(now) };
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    const state = validateCollectionState(parsed);

    if (!state) {
      return {
        state: defaultCollectionState(now),
        warning:
          "Saved collection data could not be used. A clean local collection is active until you save again.",
      };
    }

    return { state };
  } catch {
    return {
      state: defaultCollectionState(now),
      warning:
        "Saved collection data was not valid JSON. A clean local collection is active until you save again.",
    };
  }
}

export function loadCollection(storage: StorageLike): CollectionLoadResult {
  return parseStoredCollection(storage.getItem(COLLECTION_STORAGE_KEY));
}

export function saveCollection(
  storage: StorageLike,
  state: CollectionState,
): void {
  storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state));
}

export function addAsset(
  state: CollectionState,
  assetId: string,
  now = currentTimestamp(),
): CollectionState {
  if (!assetIds.has(assetId) || state.assetIds.includes(assetId)) {
    return state;
  }

  return {
    ...state,
    assetIds: [...state.assetIds, assetId],
    updatedAt: now,
  };
}

export function removeAsset(
  state: CollectionState,
  assetId: string,
  now = currentTimestamp(),
): CollectionState {
  if (!state.assetIds.includes(assetId)) {
    return state;
  }

  return {
    ...state,
    assetIds: state.assetIds.filter((id) => id !== assetId),
    updatedAt: now,
  };
}

export function moveAsset(
  state: CollectionState,
  assetId: string,
  direction: -1 | 1,
  now = currentTimestamp(),
): CollectionState {
  const index = state.assetIds.indexOf(assetId);
  const nextIndex = index + direction;

  if (index === -1 || nextIndex < 0 || nextIndex >= state.assetIds.length) {
    return state;
  }

  const nextIds = [...state.assetIds];
  const [item] = nextIds.splice(index, 1);
  nextIds.splice(nextIndex, 0, item);

  return {
    ...state,
    assetIds: nextIds,
    updatedAt: now,
  };
}

export function renameCollection(
  state: CollectionState,
  name: string,
  now = currentTimestamp(),
): CollectionState {
  const nextName = sanitizeCollectionName(name);

  if (!nextName) {
    throw new Error("Collection name cannot be empty.");
  }

  return {
    ...state,
    name: nextName,
    updatedAt: now,
  };
}

export function clearCollection(
  state: CollectionState,
  now = currentTimestamp(),
): CollectionState {
  return {
    ...state,
    assetIds: [],
    updatedAt: now,
  };
}

export function resolveCollectionItems(
  state: CollectionState,
): ResolvedCollectionItem[] {
  return state.assetIds.map((id) => {
    const asset = seedAssets.find((candidate) => candidate.id === id);
    return {
      id,
      asset,
      missing: !asset,
    };
  });
}

export function collectionCount(state: CollectionState): number {
  return state.assetIds.length;
}

export function missingCollectionItems(state: CollectionState): string[] {
  return resolveCollectionItems(state)
    .filter((item) => item.missing)
    .map((item) => item.id);
}
