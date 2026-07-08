import JSZip from "jszip";

import { galleryKindConfigs } from "@/data/discovery";
import type { SeedAsset } from "@/data/assets";

export type ZipStatus = "complete" | "partial" | "failed" | "cancelled";
export type ZipPhase =
  | "preparing"
  | "fetching"
  | "creating"
  | "complete"
  | "partial"
  | "failed"
  | "cancelled";

export interface ZipProgress {
  phase: ZipPhase;
  completed: number;
  total: number;
  message: string;
}

export interface ZipFailure {
  assetId: string;
  title: string;
  reason: string;
}

export interface ZipResult {
  status: ZipStatus;
  blob?: Blob;
  completed: number;
  total: number;
  failures: ZipFailure[];
}

export interface CreateCollectionZipOptions {
  assets: SeedAsset[];
  fetcher?: (url: string, signal: AbortSignal) => Promise<Blob>;
  concurrency?: number;
  signal: AbortSignal;
  onProgress?: (progress: ZipProgress) => void;
}

export function sanitizeFilename(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "asset"
  );
}

export function zipPathForAsset(asset: SeedAsset): string {
  const folder = sanitizeFilename(
    galleryKindConfigs[asset.kind].path.replace("/", ""),
  );
  return `${folder}/${sanitizeFilename(asset.slug)}.svg`;
}

async function defaultFetcher(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.blob();
}

export async function settleWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await tasks[currentIndex](),
        };
      } catch (error) {
        results[currentIndex] = {
          status: "rejected",
          reason: error,
        };
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), tasks.length) },
      () => worker(),
    ),
  );

  return results;
}

export async function createCollectionZip({
  assets,
  fetcher = defaultFetcher,
  concurrency = 3,
  signal,
  onProgress,
}: CreateCollectionZipOptions): Promise<ZipResult> {
  const total = assets.length;

  if (total === 0) {
    return {
      status: "failed",
      completed: 0,
      total: 0,
      failures: [],
    };
  }

  onProgress?.({
    phase: "preparing",
    completed: 0,
    total,
    message: "Preparing collection download.",
  });

  let completed = 0;
  const fetchResults = await settleWithConcurrency(
    assets.map((asset, index) => async () => {
      if (signal.aborted) {
        throw new DOMException("Download cancelled.", "AbortError");
      }

      onProgress?.({
        phase: "fetching",
        completed,
        total,
        message: `Fetching item ${index + 1} of ${total}.`,
      });

      const blob = await fetcher(asset.localSource, signal);
      const data = await blob.arrayBuffer();
      completed += 1;
      onProgress?.({
        phase: "fetching",
        completed,
        total,
        message: `Fetched ${completed} of ${total}.`,
      });

      return { asset, data };
    }),
    concurrency,
  );

  if (signal.aborted) {
    onProgress?.({
      phase: "cancelled",
      completed,
      total,
      message: "Download cancelled.",
    });
    return { status: "cancelled", completed, total, failures: [] };
  }

  const failures: ZipFailure[] = [];
  const zip = new JSZip();
  let successCount = 0;

  fetchResults.forEach((result, index) => {
    const asset = assets[index];

    if (result.status === "fulfilled") {
      zip.file(zipPathForAsset(result.value.asset), result.value.data);
      successCount += 1;
    } else {
      failures.push({
        assetId: asset.id,
        title: asset.title,
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown fetch failure",
      });
    }
  });

  if (successCount === 0) {
    onProgress?.({
      phase: "failed",
      completed,
      total,
      message: "No files could be fetched.",
    });
    return { status: "failed", completed, total, failures };
  }

  try {
    onProgress?.({
      phase: "creating",
      completed,
      total,
      message: "Creating ZIP file.",
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const status = failures.length ? "partial" : "complete";

    onProgress?.({
      phase: status,
      completed,
      total,
      message:
        status === "complete"
          ? "Collection ZIP ready."
          : "Collection ZIP ready with some failed items.",
    });

    return { status, blob, completed, total, failures };
  } catch (error) {
    return {
      status: "failed",
      completed,
      total,
      failures: [
        ...failures,
        {
          assetId: "zip-generation",
          title: "ZIP generation",
          reason:
            error instanceof Error ? error.message : "Unknown ZIP failure",
        },
      ],
    };
  }
}
