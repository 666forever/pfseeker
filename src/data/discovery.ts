import { seedAssets, type SeedAsset } from "@/data/assets";
import {
  getCategoriesForKind,
  getCategory,
  getCategoryForKind,
  seedCategories,
  type SeedCategory,
} from "@/data/categories";
import {
  buildLocalResponsiveImage,
  buildResponsiveImage,
  type AssetKind,
  type MediaFormat,
  type ResponsiveImageDescriptor,
} from "@/lib/media";

export type SortKey = "newest" | "oldest" | "title-asc" | "title-desc";

export interface GalleryKindConfig {
  kind: AssetKind;
  pluralLabel: string;
  singularLabel: string;
  detailPath: string;
  path: string;
  title: string;
  description: string;
  introduction: string;
  imageSizes: string;
  imageWidths: number[];
}

export const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
] satisfies { value: SortKey; label: string }[];

export const galleryKindConfigs = {
  pfp: {
    kind: "pfp",
    pluralLabel: "Profile Pictures",
    singularLabel: "Profile Picture",
    detailPath: "/pfp",
    path: "/pfps",
    title: "Profile Pictures",
    description:
      "Browse original seed profile pictures on pfseeker while the production media library is prepared.",
    introduction:
      "A small original seed library for validating profile-picture browsing, category structure, responsive previews, and route behavior before D1 content is introduced.",
    imageSizes: "(min-width: 1120px) 25vw, (min-width: 720px) 33vw, 90vw",
    imageWidths: [240, 360, 520],
  },
  banner: {
    kind: "banner",
    pluralLabel: "Banners",
    singularLabel: "Banner",
    detailPath: "/banner",
    path: "/banners",
    title: "Banners",
    description:
      "Browse original seed banners on pfseeker with stable wide previews and restrained metadata.",
    introduction:
      "Wide seed compositions for testing banner proportions, category navigation, responsive image descriptors, and server-rendered gallery HTML.",
    imageSizes: "(min-width: 1120px) 38vw, (min-width: 720px) 48vw, 92vw",
    imageWidths: [480, 760, 1040],
  },
  icon: {
    kind: "icon",
    pluralLabel: "Icons",
    singularLabel: "Icon",
    detailPath: "/icon",
    path: "/icons",
    title: "Icons",
    description:
      "Browse original seed icons on pfseeker with compact previews and data-driven taxonomy.",
    introduction:
      "Compact seed marks for checking icon fit behavior, small-artwork readability, category filtering, and accessible card rhythm.",
    imageSizes: "(min-width: 1120px) 18vw, (min-width: 720px) 24vw, 46vw",
    imageWidths: [128, 220, 320],
  },
} satisfies Record<AssetKind, GalleryKindConfig>;

const supportedFormats = new Set<MediaFormat>([
  "avif",
  "gif",
  "jpg",
  "png",
  "svg",
  "webp",
]);
const supportedKinds = new Set<AssetKind>(["pfp", "banner", "icon"]);
const normalizedTagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSeedTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function parseSort(value: string | null | undefined): SortKey {
  return sortOptions.some((option) => option.value === value)
    ? (value as SortKey)
    : "newest";
}

export function sortAssets(assets: SeedAsset[], sort: SortKey): SeedAsset[] {
  const sorted = [...assets];

  return sorted.sort((a, b) => {
    if (sort === "oldest") {
      return (
        a.publishedAt.localeCompare(b.publishedAt) ||
        a.title.localeCompare(b.title)
      );
    }

    if (sort === "title-asc") {
      return (
        a.title.localeCompare(b.title) ||
        b.publishedAt.localeCompare(a.publishedAt)
      );
    }

    if (sort === "title-desc") {
      return (
        b.title.localeCompare(a.title) ||
        b.publishedAt.localeCompare(a.publishedAt)
      );
    }

    return (
      b.publishedAt.localeCompare(a.publishedAt) ||
      a.title.localeCompare(b.title)
    );
  });
}

export function getAssetsByKind(
  kind: AssetKind,
  sort: SortKey = "newest",
): SeedAsset[] {
  return sortAssets(
    seedAssets.filter((asset) => asset.kind === kind),
    sort,
  );
}

export function getAssetsByCategory(
  kind: AssetKind,
  categorySlug: string,
  sort: SortKey = "newest",
): SeedAsset[] {
  return sortAssets(
    seedAssets.filter(
      (asset) => asset.kind === kind && asset.categories.includes(categorySlug),
    ),
    sort,
  );
}

export function getAssetById(id: string): SeedAsset | undefined {
  return seedAssets.find((asset) => asset.id === id);
}

export function getAssetByKindAndSlug(
  kind: AssetKind,
  slug: string,
): SeedAsset | undefined {
  return seedAssets.find((asset) => asset.kind === kind && asset.slug === slug);
}

export function getAssetRoute(asset: SeedAsset): string {
  return `${galleryKindConfigs[asset.kind].detailPath}/${asset.slug}`;
}

export function getCategoryRoute(
  kind: AssetKind,
  category: SeedCategory,
): string {
  return `${galleryKindConfigs[kind].path}/${category.slug}`;
}

export function searchAssets(
  query: string,
  sort: SortKey = "newest",
): SeedAsset[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return sortAssets(
    seedAssets.filter((asset) => {
      const categoryNames = asset.categories
        .map((slug) => getCategory(slug)?.name ?? slug)
        .join(" ");
      const haystack = [
        asset.title,
        asset.kind,
        categoryNames,
        ...asset.categories,
        ...asset.tags,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    }),
    sort,
  );
}

export function buildSeedImageDescriptor(
  asset: SeedAsset,
): ResponsiveImageDescriptor {
  const config = galleryKindConfigs[asset.kind];
  if (asset.mediaSourceType === "cloudinary") {
    const publicId = asset.cloudinaryPublicId ?? asset.localSource;
    return buildResponsiveImage(
      {
        kind: asset.kind,
        publicId,
        alt: asset.alt,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        animation: asset.animation,
      },
      {
        cloudName: asset.cloudinaryCloudName ?? undefined,
        preset: asset.kind,
        sizes: config.imageSizes,
        widths: config.imageWidths,
      },
    );
  }

  return buildLocalResponsiveImage(
    {
      kind: asset.kind,
      localSrc: asset.localSource,
      alt: asset.alt,
      width: asset.width,
      height: asset.height,
      format: asset.format,
      animation: asset.animation,
    },
    {
      preset: asset.kind,
      sizes: config.imageSizes,
      widths: config.imageWidths,
    },
  );
}

export function getAssetMetaDescription(asset: SeedAsset): string {
  const config = galleryKindConfigs[asset.kind];
  const categoryNames = asset.categories
    .map((slug) => getCategory(slug)?.name ?? slug)
    .join(", ");

  return `${asset.title} is an original pfseeker seed ${config.singularLabel.toLowerCase()} with ${asset.width} by ${asset.height} ${asset.format.toUpperCase()} preview media. Categories: ${categoryNames}.`;
}

export function getRelatedAssets(asset: SeedAsset, limit = 4): SeedAsset[] {
  return seedAssets
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

export function validateSeedData(
  assets: SeedAsset[] = seedAssets,
  categories: SeedCategory[] = seedCategories,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const localSources = new Set<string>();
  const slugsByKind = new Map<AssetKind, Set<string>>();
  const categorySlugs = new Set<string>();
  const usedCategorySlugs = new Set<string>();

  for (const category of categories) {
    if (!category.slug || !category.name || !category.description) {
      errors.push(
        `Category ${category.slug || "(missing slug)"} is incomplete.`,
      );
    }

    if (categorySlugs.has(category.slug)) {
      errors.push(`Duplicate category slug: ${category.slug}.`);
    }

    categorySlugs.add(category.slug);

    for (const kind of category.kinds) {
      if (!supportedKinds.has(kind)) {
        errors.push(
          `Category ${category.slug} references unsupported kind ${kind}.`,
        );
      }
    }
  }

  for (const asset of assets) {
    if (ids.has(asset.id)) {
      errors.push(`Duplicate asset ID: ${asset.id}.`);
    }

    ids.add(asset.id);

    const slugs = slugsByKind.get(asset.kind) ?? new Set<string>();
    if (slugs.has(asset.slug)) {
      errors.push(`Duplicate ${asset.kind} slug: ${asset.slug}.`);
    }
    slugs.add(asset.slug);
    slugsByKind.set(asset.kind, slugs);

    if (!supportedKinds.has(asset.kind)) {
      errors.push(`Asset ${asset.id} has unsupported kind ${asset.kind}.`);
    }

    if (!asset.title.trim() || !asset.alt.trim()) {
      errors.push(`Asset ${asset.id} needs non-empty title and alt text.`);
    }

    if (!Number.isInteger(asset.width) || asset.width <= 0) {
      errors.push(`Asset ${asset.id} has invalid width.`);
    }

    if (!Number.isInteger(asset.height) || asset.height <= 0) {
      errors.push(`Asset ${asset.id} has invalid height.`);
    }

    if (!supportedFormats.has(asset.format)) {
      errors.push(`Asset ${asset.id} has unsupported format ${asset.format}.`);
    }

    if (!asset.localSource.startsWith(`/seed-media/${asset.id}.svg`)) {
      errors.push(`Asset ${asset.id} has an invalid local source.`);
    }

    if (localSources.has(asset.localSource)) {
      errors.push(`Duplicate local source: ${asset.localSource}.`);
    }

    localSources.add(asset.localSource);

    if (!asset.categories.length) {
      errors.push(`Asset ${asset.id} must have at least one category.`);
    }

    for (const categorySlug of asset.categories) {
      usedCategorySlugs.add(categorySlug);
      const category = getCategoryForKind(asset.kind, categorySlug);
      if (!category) {
        errors.push(
          `Asset ${asset.id} references incompatible category ${categorySlug}.`,
        );
      }
    }

    if (!asset.tags.length || asset.tags.some((tag) => !tag.trim())) {
      errors.push(`Asset ${asset.id} must have non-empty tags.`);
    }

    const normalizedTags = asset.tags.map(normalizeSeedTag);
    if (normalizedTags.some((tag) => !normalizedTagPattern.test(tag))) {
      errors.push(`Asset ${asset.id} has invalid normalized tags.`);
    }
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      errors.push(`Asset ${asset.id} has duplicate normalized tags.`);
    }

    if (Number.isNaN(Date.parse(asset.publishedAt))) {
      errors.push(`Asset ${asset.id} has invalid published date.`);
    }

    if (
      asset.palette.length !== 3 ||
      asset.palette.some((color) => !/^#[0-9a-f]{6}$/i.test(color))
    ) {
      errors.push(`Asset ${asset.id} has invalid palette metadata.`);
    }
  }

  for (const kind of supportedKinds) {
    if (!getCategoriesForKind(kind).length) {
      errors.push(`No categories exist for ${kind}.`);
    }

    if (!assets.some((asset) => asset.kind === kind)) {
      errors.push(`No seed assets exist for ${kind}.`);
    }
  }

  for (const category of categories) {
    if (!usedCategorySlugs.has(category.slug)) {
      errors.push(
        `Category ${category.slug} is unused by current seed assets.`,
      );
    }
  }

  return errors;
}

export function assertValidSeedData(): void {
  const errors = validateSeedData();

  if (errors.length) {
    throw new Error(`Invalid seed data:\n${errors.join("\n")}`);
  }
}

assertValidSeedData();
