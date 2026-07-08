import type { SeedAsset } from "@/data/assets";
import type { SeedCategory } from "@/data/categories";
import type { AssetKind } from "@/lib/media";
import type { SearchFilters } from "@/lib/search";

export interface DownloadEventInput {
  assetId: string;
  source?: "api" | "preview" | "original";
}

export interface DownloadEventResult {
  id: string;
  assetId: string;
  recorded: true;
}

export interface ContentRepository {
  getAssetById(id: string): Promise<SeedAsset | undefined>;
  getAssetByKindAndSlug(
    kind: AssetKind,
    slug: string,
  ): Promise<SeedAsset | undefined>;
  listAssets(filters?: SearchFilters): Promise<SeedAsset[]>;
  listCategories(kind?: AssetKind): Promise<SeedCategory[]>;
  listTags(): Promise<string[]>;
  searchAssets(filters: SearchFilters): Promise<SeedAsset[]>;
  getRelatedAssets(asset: SeedAsset, limit?: number): Promise<SeedAsset[]>;
  recordDownload(input: DownloadEventInput): Promise<DownloadEventResult>;
}
