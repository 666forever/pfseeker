import { seedAssets, type SeedAsset } from "@/data/assets";
import { getCategoriesForKind, seedCategories } from "@/data/categories";
import { sortAssets } from "@/data/discovery";
import { filterAssets } from "@/lib/search";
import type { AssetKind } from "@/lib/media";
import { RepositoryError } from "@/server/repositories/errors";
import type {
  ContentRepository,
  DownloadEventResult,
} from "@/server/repositories/types";

function relatedAssetsFor(
  asset: SeedAsset,
  source: SeedAsset[],
  limit = 4,
): SeedAsset[] {
  return source
    .filter((candidate) => candidate.id !== asset.id)
    .map((candidate) => {
      const sharedCategories = candidate.categories.filter((category) =>
        asset.categories.includes(category),
      ).length;
      const sharedTags = candidate.tags.filter((tag) =>
        asset.tags.includes(tag),
      ).length;
      const sameKind = candidate.kind === asset.kind ? 1 : 0;

      return {
        candidate,
        score: sameKind * 100 + sharedCategories * 10 + sharedTags,
      };
    })
    .sort((a, b) => {
      return (
        b.score - a.score ||
        b.candidate.publishedAt.localeCompare(a.candidate.publishedAt) ||
        a.candidate.title.localeCompare(b.candidate.title) ||
        a.candidate.id.localeCompare(b.candidate.id)
      );
    })
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export function createSeedRepository(
  source: SeedAsset[] = seedAssets,
): ContentRepository {
  return {
    async getAssetById(id) {
      return source.find((asset) => asset.id === id);
    },
    async getAssetByKindAndSlug(kind, slug) {
      return source.find((asset) => asset.kind === kind && asset.slug === slug);
    },
    async listAssets(filters) {
      return filters
        ? filterAssets(filters, source)
        : sortAssets(source, "newest");
    },
    async listCategories(kind?: AssetKind) {
      return kind ? getCategoriesForKind(kind) : seedCategories;
    },
    async listTags() {
      return Array.from(new Set(source.flatMap((asset) => asset.tags))).sort();
    },
    async searchAssets(filters) {
      return filterAssets(filters, source);
    },
    async getRelatedAssets(asset, limit) {
      return relatedAssetsFor(asset, source, limit);
    },
    async recordDownload(): Promise<DownloadEventResult> {
      throw new RepositoryError(
        "Download recording requires a configured Cloudflare D1 binding.",
      );
    },
  };
}
