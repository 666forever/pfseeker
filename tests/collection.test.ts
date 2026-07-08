import { describe, expect, it } from "vitest";

import { seedAssets } from "@/data/assets";
import {
  addAsset,
  clearCollection,
  COLLECTION_SCHEMA_VERSION,
  COLLECTION_STORAGE_KEY,
  collectionCount,
  defaultCollectionState,
  loadCollection,
  missingCollectionItems,
  moveAsset,
  parseStoredCollection,
  removeAsset,
  renameCollection,
  resolveCollectionItems,
  saveCollection,
  validateCollectionState,
} from "@/lib/collection";
import {
  createCollectionZip,
  sanitizeFilename,
  settleWithConcurrency,
  zipPathForAsset,
} from "@/lib/collection-zip";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("local collection state", () => {
  it("creates a versioned default state", () => {
    const state = defaultCollectionState("2026-07-05T00:00:00.000Z");

    expect(state).toEqual({
      version: COLLECTION_SCHEMA_VERSION,
      name: "Local collection",
      assetIds: [],
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
  });

  it("round-trips through the configured storage key", () => {
    const storage = new MemoryStorage();
    const state = addAsset(defaultCollectionState(), seedAssets[0].id);

    saveCollection(storage, state);

    expect(storage.getItem(COLLECTION_STORAGE_KEY)).toContain(seedAssets[0].id);
    expect(loadCollection(storage).state.assetIds).toEqual([seedAssets[0].id]);
  });

  it("recovers safely from corrupt or unsupported stored data", () => {
    expect(parseStoredCollection("{bad json").warning).toContain(
      "not valid JSON",
    );

    const unsupported = JSON.stringify({
      version: 99,
      name: "Old",
      assetIds: [seedAssets[0].id],
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(parseStoredCollection(unsupported).warning).toContain(
      "could not be used",
    );
  });

  it("validates schema, sanitizes names, and removes duplicate IDs", () => {
    const state = validateCollectionState({
      version: COLLECTION_SCHEMA_VERSION,
      name: "  My   saved   set  ",
      assetIds: [seedAssets[0].id, seedAssets[0].id, "missing-id"],
      createdAt: "not a date",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(state?.name).toBe("My saved set");
    expect(state?.assetIds).toEqual([seedAssets[0].id, "missing-id"]);
    expect(state?.updatedAt).toBe("2026-07-05T00:00:00.000Z");
  });

  it("adds, removes, clears, renames, counts, and prevents duplicates", () => {
    const first = seedAssets[0].id;
    const second = seedAssets[1].id;
    let state = defaultCollectionState("2026-07-05T00:00:00.000Z");

    state = addAsset(state, first, "2026-07-05T00:01:00.000Z");
    state = addAsset(state, first, "2026-07-05T00:02:00.000Z");
    state = addAsset(state, "not-a-seed-asset");
    state = addAsset(state, second, "2026-07-05T00:03:00.000Z");

    expect(state.assetIds).toEqual([first, second]);
    expect(collectionCount(state)).toBe(2);

    state = removeAsset(state, first, "2026-07-05T00:04:00.000Z");
    expect(state.assetIds).toEqual([second]);

    state = renameCollection(state, "  Compact   set  ");
    expect(state.name).toBe("Compact set");
    expect(() => renameCollection(state, "   ")).toThrow(
      "Collection name cannot be empty.",
    );

    state = clearCollection(state);
    expect(state.assetIds).toEqual([]);
  });

  it("reorders by ID and preserves unresolved saved IDs", () => {
    let state = defaultCollectionState();
    state = addAsset(state, seedAssets[0].id);
    state = addAsset(state, seedAssets[1].id);
    state = {
      ...state,
      assetIds: [...state.assetIds, "legacy-missing-id"],
    };

    state = moveAsset(state, seedAssets[1].id, -1);

    expect(state.assetIds).toEqual([
      seedAssets[1].id,
      seedAssets[0].id,
      "legacy-missing-id",
    ]);
    expect(moveAsset(state, seedAssets[1].id, -1)).toBe(state);
    expect(resolveCollectionItems(state).at(-1)).toEqual({
      id: "legacy-missing-id",
      asset: undefined,
      missing: true,
    });
    expect(missingCollectionItems(state)).toEqual(["legacy-missing-id"]);
  });
});

describe("collection ZIP creation", () => {
  it("uses safe, kind-scoped SVG filenames", () => {
    expect(sanitizeFilename(" A messy/name!.svg ")).toBe("a-messy-name-.svg");
    expect(zipPathForAsset(seedAssets[0])).toBe("pfps/ember-orbit.svg");
    expect(
      zipPathForAsset(seedAssets.find((asset) => asset.kind === "banner")!),
    ).toBe("banners/slate-horizon.svg");
  });

  it("settles concurrent work without rejecting the whole batch", async () => {
    const results = await settleWithConcurrency(
      [
        async () => "first",
        async () => {
          throw new Error("second failed");
        },
        async () => "third",
      ],
      2,
    );

    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
  });

  it("creates a complete ZIP when every asset fetch succeeds", async () => {
    const controller = new AbortController();
    const progress: string[] = [];

    const result = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      signal: controller.signal,
      fetcher: async () => new Blob(["<svg></svg>"], { type: "image/svg+xml" }),
      onProgress: (next) => progress.push(next.phase),
    });

    expect(result.status).toBe("complete");
    expect(result.completed).toBe(2);
    expect(result.failures).toEqual([]);
    expect(result.blob?.size).toBeGreaterThan(0);
    expect(progress).toContain("creating");
    expect(progress).toContain("complete");
  });

  it("returns a partial ZIP when only some asset fetches fail", async () => {
    const controller = new AbortController();

    const result = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      signal: controller.signal,
      fetcher: async (url) => {
        if (url.includes(seedAssets[1].id)) {
          throw new Error("network failed");
        }

        return new Blob(["<svg></svg>"], { type: "image/svg+xml" });
      },
    });

    expect(result.status).toBe("partial");
    expect(result.completed).toBe(1);
    expect(result.failures).toEqual([
      {
        assetId: seedAssets[1].id,
        title: seedAssets[1].title,
        reason: "network failed",
      },
    ]);
    expect(result.blob?.size).toBeGreaterThan(0);
  });

  it("reports all-failure and empty collection download attempts", async () => {
    const failed = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      signal: new AbortController().signal,
      fetcher: async () => {
        throw new Error("offline");
      },
    });

    expect(failed.status).toBe("failed");
    expect(failed.failures).toHaveLength(2);

    const empty = await createCollectionZip({
      assets: [],
      signal: new AbortController().signal,
    });

    expect(empty).toMatchObject({
      status: "failed",
      completed: 0,
      total: 0,
      failures: [],
    });
  });

  it("supports cancellation through AbortController", async () => {
    const controller = new AbortController();

    const result = await createCollectionZip({
      assets: seedAssets.slice(0, 2),
      concurrency: 1,
      signal: controller.signal,
      fetcher: async () => {
        controller.abort();
        throw new DOMException("Download cancelled.", "AbortError");
      },
    });

    expect(result.status).toBe("cancelled");
    expect(result.completed).toBe(0);
  });
});
