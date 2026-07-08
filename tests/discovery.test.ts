import { describe, expect, it } from "vitest";

import { seedAssets, type SeedAsset } from "@/data/assets";
import { getCategoriesForKind } from "@/data/categories";
import {
  buildSeedImageDescriptor,
  galleryKindConfigs,
  getAssetByKindAndSlug,
  getAssetMetaDescription,
  getAssetRoute,
  getAssetsByCategory,
  getAssetsByKind,
  getCategoryRoute,
  getRelatedAssets,
  parseSort,
  searchAssets,
  sortAssets,
  validateSeedData,
} from "@/data/discovery";

describe("seed data validation", () => {
  it("accepts the committed seed dataset", () => {
    expect(validateSeedData()).toEqual([]);
  });

  it("detects duplicate IDs and slugs", () => {
    const duplicate = {
      ...seedAssets[0],
      id: seedAssets[1].id,
      slug: seedAssets[1].slug,
      kind: seedAssets[1].kind,
    } satisfies SeedAsset;

    expect(validateSeedData([seedAssets[1], duplicate])).toEqual(
      expect.arrayContaining([
        `Duplicate asset ID: ${seedAssets[1].id}.`,
        `Duplicate ${seedAssets[1].kind} slug: ${seedAssets[1].slug}.`,
      ]),
    );
  });

  it("detects incompatible category references", () => {
    const invalid = {
      ...seedAssets[0],
      categories: ["texture"],
    } satisfies SeedAsset;

    expect(validateSeedData([invalid])).toContain(
      `Asset ${invalid.id} references incompatible category texture.`,
    );
  });
});

describe("taxonomy and filtering", () => {
  it("keeps categories compatible with content types", () => {
    expect(
      getCategoriesForKind("pfp").map((category) => category.slug),
    ).toEqual([
      "dark",
      "minimal",
      "monochrome",
      "abstract",
      "character",
      "photography",
    ]);
    expect(
      getCategoriesForKind("banner").map((category) => category.slug),
    ).toEqual([
      "monochrome",
      "abstract",
      "atmospheric",
      "landscape",
      "texture",
    ]);
    expect(
      getCategoriesForKind("icon").map((category) => category.slug),
    ).toEqual(["minimal", "monochrome", "interface", "social", "symbols"]);
  });

  it("filters assets by kind and category", () => {
    expect(getAssetsByKind("pfp")).toHaveLength(10);
    expect(getAssetsByKind("banner")).toHaveLength(7);
    expect(getAssetsByKind("icon")).toHaveLength(7);
    expect(
      getAssetsByCategory("banner", "texture").map((asset) => asset.slug),
    ).toEqual(["copper-static", "basal-ridges", "charcoal-mesh"]);
  });

  it("generates stable route paths without requiring Phase 6 pages", () => {
    expect(getCategoryRoute("pfp", getCategoriesForKind("pfp")[0])).toBe(
      "/pfps/dark",
    );
    expect(getAssetRoute(seedAssets[0])).toBe("/pfp/ember-orbit");
  });
});

describe("asset detail routing", () => {
  it("looks up assets by matching kind and slug", () => {
    expect(getAssetByKindAndSlug("pfp", "ember-orbit")?.id).toBe(
      "pfp-ember-orbit",
    );
    expect(getAssetByKindAndSlug("banner", "ember-orbit")).toBeUndefined();
    expect(getAssetByKindAndSlug("pfp", "missing")).toBeUndefined();
  });

  it("maps every seed asset to exactly one route", () => {
    const routes = seedAssets.map(getAssetRoute);

    expect(new Set(routes).size).toBe(seedAssets.length);
    expect(routes.filter((route) => route.startsWith("/pfp/"))).toHaveLength(
      10,
    );
    expect(routes.filter((route) => route.startsWith("/banner/"))).toHaveLength(
      7,
    );
    expect(routes.filter((route) => route.startsWith("/icon/"))).toHaveLength(
      7,
    );
  });

  it("builds accurate metadata descriptions", () => {
    expect(getAssetMetaDescription(seedAssets[0])).toContain(
      "Ember Orbit is an original pfseeker seed profile picture",
    );
    expect(getAssetMetaDescription(seedAssets[0])).toContain(
      "1024 by 1024 SVG",
    );
  });

  it("selects deterministic related assets without duplicates", () => {
    const asset = getAssetByKindAndSlug("pfp", "ember-orbit");
    expect(asset).toBeDefined();

    const related = getRelatedAssets(asset as SeedAsset, 4);

    expect(related.map((entry) => entry.slug)).toEqual([
      "mist-aperture",
      "cinder-portrait",
      "violet-field",
      "lens-bloom",
    ]);
    expect(related).not.toContain(asset);
    expect(new Set(related.map((entry) => entry.id)).size).toBe(related.length);
  });
});

describe("search and sorting", () => {
  it("parses supported sorts and safely falls back for unknown values", () => {
    expect(parseSort("oldest")).toBe("oldest");
    expect(parseSort("popular")).toBe("newest");
    expect(parseSort(undefined)).toBe("newest");
  });

  it("sorts by newest, oldest, and title", () => {
    const sample = [
      seedAssets.find((asset) => asset.slug === "fog-bank"),
      seedAssets.find((asset) => asset.slug === "amber-drift"),
      seedAssets.find((asset) => asset.slug === "blue-hour"),
    ].filter(Boolean) as SeedAsset[];

    expect(sortAssets(sample, "newest").map((asset) => asset.slug)).toEqual([
      "blue-hour",
      "amber-drift",
      "fog-bank",
    ]);
    expect(sortAssets(sample, "oldest").map((asset) => asset.slug)).toEqual([
      "fog-bank",
      "amber-drift",
      "blue-hour",
    ]);
    expect(sortAssets(sample, "title-asc").map((asset) => asset.slug)).toEqual([
      "amber-drift",
      "blue-hour",
      "fog-bank",
    ]);
  });

  it("searches title, kind, categories, and tags case-insensitively", () => {
    expect(searchAssets("  RIDGE  ").map((asset) => asset.slug)).toEqual([
      "ridge-stack",
      "basal-ridges",
      "silver-ridge",
    ]);
    expect(searchAssets("icon")).toHaveLength(7);
    expect(searchAssets("atmospheric").map((asset) => asset.kind)).toEqual([
      "banner",
      "banner",
      "banner",
    ]);
    expect(searchAssets("not-present")).toEqual([]);
  });
});

describe("image descriptor integration", () => {
  it("builds local responsive image descriptors from seed records", () => {
    const descriptor = buildSeedImageDescriptor(seedAssets[0]);

    expect(descriptor).toMatchObject({
      src: "/seed-media/pfp-ember-orbit.svg",
      alt: seedAssets[0].alt,
      width: 1024,
      height: 1024,
      aspectRatio: "1024 / 1024",
      sizes: galleryKindConfigs.pfp.imageSizes,
      downloadUrl: "/seed-media/pfp-ember-orbit.svg",
    });
    expect(descriptor.srcset).toContain("/seed-media/pfp-ember-orbit.svg 240w");
  });
});
