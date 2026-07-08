import { InvalidRepositoryInputError } from "@/server/repositories/errors";
import type {
  ContentRepository,
  DownloadEventInput,
  DownloadEventResult,
} from "@/server/repositories/types";

export async function recordDownloadEvent(
  repository: ContentRepository,
  input: DownloadEventInput,
): Promise<DownloadEventResult> {
  if (!input.assetId.trim()) {
    throw new InvalidRepositoryInputError(
      "A download event needs an asset ID.",
    );
  }

  return repository.recordDownload({
    assetId: input.assetId,
    source: input.source ?? "api",
  });
}
