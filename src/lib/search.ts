import { seedAssets, type SeedAsset } from "@/data/assets";
import {
  getCategoriesForKind,
  getCategory,
  getCategoryForKind,
  seedCategories,
  type SeedCategory,
} from "@/data/categories";
import { sortAssets, sortOptions, type SortKey } from "@/data/discovery";
import type { AnimationState, AssetKind, MediaFormat } from "@/lib/media";

export const typeOptions = ["all", "pfp", "banner", "icon"] as const;
export const animationOptions = ["all", "static", "animated"] as const;
export const formatOptions = ["all", "svg"] as const;
export const orientationOptions = [
  "all",
  "square",
  "landscape",
  "portrait",
] as const;
export const colorOptions = [
  "all",
  "black",
  "white",
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
  "multicolor",
] as const;

export type SearchType = (typeof typeOptions)[number];
export type SearchAnimation = (typeof animationOptions)[number];
export type SearchFormat = (typeof formatOptions)[number];
export type SearchOrientation = (typeof orientationOptions)[number];
export type SearchColor = (typeof colorOptions)[number];

export interface SearchFilters {
  q: string;
  type: SearchType;
  category: string;
  tag: string;
  format: SearchFormat;
  animation: SearchAnimation;
  orientation: SearchOrientation;
  color: SearchColor;
  sort: SortKey;
}

export interface SearchContext {
  basePath: string;
  fixedType?: AssetKind;
  fixedCategory?: string;
  includeType?: boolean;
}

export interface ActiveFilter {
  key: keyof SearchFilters;
  value: string;
  label: string;
  href: string;
}

const supportedKinds = new Set<AssetKind>(["pfp", "banner", "icon"]);
const sortValues = new Set(sortOptions.map((option) => option.value));
const normalizedTagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const colorValueSet = new Set<string>(colorOptions);

export function normalizeTextQuery(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

function firstParam(params: URLSearchParams, key: string): string {
  return params.getAll(key).find((value) => value.trim()) ?? "";
}

function parseEnum<T extends readonly string[]>(
  values: T,
  rawValue: string,
  fallback: T[number],
): T[number] {
  const normalized = normalizeToken(rawValue);
  return values.includes(normalized) ? normalized : fallback;
}

function parseType(value: string, context: SearchContext): SearchType {
  if (context.fixedType) return context.fixedType;
  return parseEnum(typeOptions, value, "all");
}

function isCategoryCompatible(type: SearchType, slug: string): boolean {
  const category = getCategory(slug);
  if (!category) return false;
  if (type === "all") return true;
  return category.kinds.includes(type);
}

export function parseSearchFilters(
  params: URLSearchParams,
  context: SearchContext = { basePath: "/search", includeType: true },
): SearchFilters {
  const type = parseType(firstParam(params, "type"), context);
  const fixedCategory = context.fixedCategory
    ? normalizeToken(context.fixedCategory)
    : "";
  const parsedCategory =
    fixedCategory || normalizeToken(firstParam(params, "category"));
  const category =
    parsedCategory && isCategoryCompatible(type, parsedCategory)
      ? parsedCategory
      : "";

  return {
    q: normalizeTextQuery(firstParam(params, "q")),
    type,
    category,
    tag: normalizeToken(firstParam(params, "tag")),
    format: parseEnum(formatOptions, firstParam(params, "format"), "all"),
    animation: parseEnum(
      animationOptions,
      firstParam(params, "animation"),
      "all",
    ),
    orientation: parseEnum(
      orientationOptions,
      firstParam(params, "orientation"),
      "all",
    ),
    color: parseEnum(colorOptions, firstParam(params, "color"), "all"),
    sort: parseEnum(
      sortOptions.map((option) => option.value) as SortKey[],
      firstParam(params, "sort"),
      "newest",
    ) as SortKey,
  };
}

export function serializeSearchFilters(
  filters: SearchFilters,
  context: SearchContext,
  overrides: Partial<SearchFilters> = {},
): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (
    !context.fixedType &&
    context.includeType !== false &&
    next.type !== "all"
  ) {
    params.set("type", next.type);
  }
  if (!context.fixedCategory && next.category)
    params.set("category", next.category);
  if (next.tag) params.set("tag", next.tag);
  if (next.format !== "all") params.set("format", next.format);
  if (next.animation !== "all") params.set("animation", next.animation);
  if (next.orientation !== "all") params.set("orientation", next.orientation);
  if (next.color !== "all") params.set("color", next.color);
  if (next.sort !== "newest") params.set("sort", next.sort);

  const serialized = params.toString();
  return serialized ? `${context.basePath}?${serialized}` : context.basePath;
}

export function canonicalSearchPath(
  params: URLSearchParams,
  context: SearchContext,
): string {
  return serializeSearchFilters(parseSearchFilters(params, context), context);
}

export function getResetUrl(context: SearchContext): string {
  return context.basePath;
}

export function getAvailableCategories(filters: SearchFilters): SeedCategory[] {
  if (filters.type === "all") return seedCategories;
  return getCategoriesForKind(filters.type);
}

export function getAvailableTags(assets: SeedAsset[] = seedAssets): string[] {
  return Array.from(
    new Set(assets.flatMap((asset) => asset.tags.map(normalizeToken))),
  ).sort();
}

export function getFormatsForAssets(
  assets: SeedAsset[] = seedAssets,
): MediaFormat[] {
  return Array.from(new Set(assets.map((asset) => asset.format))).sort();
}

export function getOrientation(asset: SeedAsset): SearchOrientation {
  if (asset.width === asset.height) return "square";
  return asset.width > asset.height ? "landscape" : "portrait";
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHsl([red, green, blue]: [number, number, number]): {
  hue: number;
  saturation: number;
  lightness: number;
} {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    if (max === g) hue = 60 * ((b - r) / delta + 2);
    if (max === b) hue = 60 * ((r - g) / delta + 4);
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation,
    lightness,
  };
}

export function colorFamilyForHex(
  hex: string,
): Exclude<SearchColor, "all" | "multicolor"> {
  const { hue, saturation, lightness } = rgbToHsl(hexToRgb(hex));

  if (lightness <= 0.12) return "black";
  if (lightness >= 0.88 && saturation <= 0.35) return "white";
  if (saturation <= 0.12) return "gray";
  if (hue < 18 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 165) return "green";
  if (hue < 195) return "cyan";
  if (hue < 255) return "blue";
  if (hue < 300) return "purple";
  if (hue < 345) return "pink";

  return "gray";
}

export function colorFamiliesForAsset(asset: SeedAsset): SearchColor[] {
  const families = Array.from(
    new Set(asset.palette.map((color) => colorFamilyForHex(color))),
  );
  const chromatic = families.filter(
    (family) => !["black", "white", "gray"].includes(family),
  );

  if (families.length >= 3 || chromatic.length >= 2) {
    return [...families, "multicolor"];
  }

  return families;
}

function categoryText(asset: SeedAsset): string[] {
  return asset.categories.flatMap((slug) => {
    const category = getCategory(slug);
    return category ? [category.slug, category.name] : [slug];
  });
}

function searchableTerms(asset: SeedAsset): string {
  return [
    asset.title,
    asset.kind,
    asset.alt,
    ...asset.tags,
    ...categoryText(asset),
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesTextQuery(asset: SeedAsset, query: string): boolean {
  const terms = normalizeTextQuery(query)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  if (!terms.length) return true;
  const haystack = searchableTerms(asset);
  return terms.every((term) => haystack.includes(term));
}

export function filterAssets(
  filters: SearchFilters,
  source: SeedAsset[] = seedAssets,
): SeedAsset[] {
  const category = filters.category;
  const tag = normalizeToken(filters.tag);

  const filtered = source.filter((asset) => {
    if (!matchesTextQuery(asset, filters.q)) return false;
    if (filters.type !== "all" && asset.kind !== filters.type) return false;
    if (category && !asset.categories.includes(category)) return false;
    if (tag && !asset.tags.map(normalizeToken).includes(tag)) return false;
    if (filters.format !== "all" && asset.format !== filters.format)
      return false;
    if (
      filters.animation !== "all" &&
      asset.animation !== (filters.animation as AnimationState)
    ) {
      return false;
    }
    if (
      filters.orientation !== "all" &&
      getOrientation(asset) !== filters.orientation
    ) {
      return false;
    }
    if (
      filters.color !== "all" &&
      !colorFamiliesForAsset(asset).includes(filters.color)
    ) {
      return false;
    }
    return true;
  });

  return sortAssets(filtered, filters.sort);
}

export function pluralizeResults(count: number): string {
  return count === 1 ? "1 result" : `${count} results`;
}

export function activeFilters(
  filters: SearchFilters,
  context: SearchContext,
): ActiveFilter[] {
  const entries: ActiveFilter[] = [];

  if (filters.q) {
    entries.push({
      key: "q",
      value: filters.q,
      label: `Search: ${filters.q}`,
      href: serializeSearchFilters(filters, context, { q: "" }),
    });
  }
  if (!context.fixedType && filters.type !== "all") {
    entries.push({
      key: "type",
      value: filters.type,
      label: `Type: ${filters.type}`,
      href: serializeSearchFilters(filters, context, {
        type: "all",
        category: "",
      }),
    });
  }
  if (!context.fixedCategory && filters.category) {
    entries.push({
      key: "category",
      value: filters.category,
      label: `Category: ${getCategory(filters.category)?.name ?? filters.category}`,
      href: serializeSearchFilters(filters, context, { category: "" }),
    });
  }
  if (filters.tag) {
    entries.push({
      key: "tag",
      value: filters.tag,
      label: `Tag: ${filters.tag}`,
      href: serializeSearchFilters(filters, context, { tag: "" }),
    });
  }
  if (filters.format !== "all") {
    entries.push({
      key: "format",
      value: filters.format,
      label: `Format: ${filters.format.toUpperCase()}`,
      href: serializeSearchFilters(filters, context, { format: "all" }),
    });
  }
  if (filters.animation !== "all") {
    entries.push({
      key: "animation",
      value: filters.animation,
      label: `Motion: ${filters.animation}`,
      href: serializeSearchFilters(filters, context, { animation: "all" }),
    });
  }
  if (filters.orientation !== "all") {
    entries.push({
      key: "orientation",
      value: filters.orientation,
      label: `Orientation: ${filters.orientation}`,
      href: serializeSearchFilters(filters, context, { orientation: "all" }),
    });
  }
  if (filters.color !== "all") {
    entries.push({
      key: "color",
      value: filters.color,
      label: `Color: ${filters.color}`,
      href: serializeSearchFilters(filters, context, { color: "all" }),
    });
  }
  if (filters.sort !== "newest") {
    entries.push({
      key: "sort",
      value: filters.sort,
      label: `Sort: ${sortOptions.find((option) => option.value === filters.sort)?.label ?? filters.sort}`,
      href: serializeSearchFilters(filters, context, { sort: "newest" }),
    });
  }

  return entries;
}

export function validateTaxonomy(): string[] {
  const errors: string[] = [];
  const categorySlugs = new Set<string>();
  const usedCategories = new Set<string>();

  for (const category of seedCategories) {
    if (categorySlugs.has(category.slug)) {
      errors.push(`Duplicate category slug: ${category.slug}.`);
    }
    categorySlugs.add(category.slug);

    if (!category.description.trim()) {
      errors.push(`Category ${category.slug} needs a non-empty description.`);
    }

    for (const kind of category.kinds) {
      if (!supportedKinds.has(kind)) {
        errors.push(`Category ${category.slug} has unsupported kind ${kind}.`);
      }
    }
  }

  for (const asset of seedAssets) {
    const normalizedTags = asset.tags.map(normalizeToken);
    if (normalizedTags.some((tag) => !tag || !normalizedTagPattern.test(tag))) {
      errors.push(`Asset ${asset.id} has invalid tag normalization.`);
    }
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      errors.push(`Asset ${asset.id} has duplicate normalized tags.`);
    }

    for (const category of asset.categories) {
      if (!categorySlugs.has(category)) {
        errors.push(
          `Asset ${asset.id} references missing category ${category}.`,
        );
      } else if (!getCategoryForKind(asset.kind, category)) {
        errors.push(
          `Asset ${asset.id} references incompatible category ${category}.`,
        );
      }
      usedCategories.add(category);
    }

    for (const family of colorFamiliesForAsset(asset)) {
      if (!colorValueSet.has(family)) {
        errors.push(
          `Asset ${asset.id} maps to invalid color family ${family}.`,
        );
      }
    }
  }

  for (const category of seedCategories) {
    if (!usedCategories.has(category.slug)) {
      errors.push(
        `Category ${category.slug} is unused by current seed assets.`,
      );
    }
  }

  for (const option of sortOptions) {
    if (!sortValues.has(option.value)) {
      errors.push(`Invalid sort option ${option.value}.`);
    }
  }

  return errors;
}
