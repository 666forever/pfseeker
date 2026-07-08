import { describe, expect, it } from "vitest";

import { seedAssets, type SeedAsset } from "@/data/assets";
import {
  activeFilters,
  canonicalSearchPath,
  colorFamiliesForAsset,
  colorFamilyForHex,
  filterAssets,
  getOrientation,
  getResetUrl,
  matchesTextQuery,
  normalizeTextQuery,
  normalizeToken,
  parseSearchFilters,
  pluralizeResults,
  serializeSearchFilters,
  validateTaxonomy,
} from "@/lib/search";

const searchContext = { basePath: "/search", includeType: true };
const pfpContext = { basePath: "/pfps", fixedType: "pfp" as const };

function params(value: string): URLSearchParams {
  return new URLSearchParams(value);
}

describe("search query normalization", () => {
  it("normalizes text and token values", () => {
    expect(normalizeTextQuery("  dark    orbit  ")).toBe("dark orbit");
    expect(normalizeToken(" Soft Link ")).toBe("soft-link");
  });

  it("parses supported filters case-insensitively and omits defaults", () => {
    const filters = parseSearchFilters(
      params(
        "q= DARK &type=PFP&category=MONOCHROME&tag=Ridge&format=SVG&animation=STATIC&orientation=SQUARE&color=GRAY&sort=TITLE-ASC",
      ),
      searchContext,
    );

    expect(filters).toMatchObject({
      q: "DARK",
      type: "pfp",
      category: "monochrome",
      tag: "ridge",
      format: "svg",
      animation: "static",
      orientation: "square",
      color: "gray",
      sort: "title-asc",
    });
    expect(serializeSearchFilters(filters, searchContext)).toBe(
      "/search?q=DARK&type=pfp&category=monochrome&tag=ridge&format=svg&animation=static&orientation=square&color=gray&sort=title-asc",
    );
  });

  it("handles malformed, duplicate, empty, and unknown parameters safely", () => {
    const filters = parseSearchFilters(
      params(
        "q=&q=mist&type=unknown&type=icon&category=landscape&tag=&tag=halo&format=pdf&animation=spin&orientation=wide&color=beige&sort=popular&unused=yes",
      ),
      searchContext,
    );

    expect(filters).toMatchObject({
      q: "mist",
      type: "all",
      category: "landscape",
      tag: "halo",
      format: "all",
      animation: "all",
      orientation: "all",
      color: "all",
      sort: "newest",
    });
    expect(
      canonicalSearchPath(params("type=all&sort=newest&q=mist"), searchContext),
    ).toBe("/search?q=mist");
  });

  it("uses fixed route context and removes incompatible category filters", () => {
    expect(
      parseSearchFilters(params("type=banner&category=landscape"), pfpContext),
    ).toMatchObject({ type: "pfp", category: "" });

    const fixedCategory = {
      basePath: "/pfps/dark",
      fixedType: "pfp" as const,
      fixedCategory: "dark",
    };

    expect(
      serializeSearchFilters(
        parseSearchFilters(
          params("category=monochrome&sort=oldest"),
          fixedCategory,
        ),
        fixedCategory,
      ),
    ).toBe("/pfps/dark?sort=oldest");
  });
});

describe("search matching and filtering", () => {
  it("requires every text term and searches title, kind, tags, categories, and alt text", () => {
    const asset = seedAssets.find((entry) => entry.id === "pfp-ember-orbit")!;

    expect(matchesTextQuery(asset, "ember dark")).toBe(true);
    expect(matchesTextQuery(asset, "charcoal field")).toBe(true);
    expect(matchesTextQuery(asset, "ember landscape")).toBe(false);
  });

  it("filters by type, category, tag, format, animation, orientation, and color", () => {
    expect(
      filterAssets(
        parseSearchFilters(
          params("type=banner&orientation=landscape"),
          searchContext,
        ),
      ).map((asset) => asset.kind),
    ).toEqual(Array(7).fill("banner"));

    expect(
      filterAssets(parseSearchFilters(params("tag=ridge"), searchContext)).map(
        (asset) => asset.slug,
      ),
    ).toEqual(["ridge-stack", "basal-ridges", "silver-ridge"]);

    expect(
      filterAssets(
        parseSearchFilters(
          params("format=svg&animation=static"),
          searchContext,
        ),
      ),
    ).toHaveLength(seedAssets.length);

    expect(
      filterAssets(
        parseSearchFilters(
          params("type=pfp&category=dark&color=black"),
          searchContext,
        ),
      ).map((asset) => asset.slug),
    ).toEqual([
      "cinder-portrait",
      "lens-bloom",
      "nocturne-window",
      "ember-orbit",
    ]);
  });

  it("combines filters deterministically without mutating the source array", () => {
    const source = [...seedAssets];
    const before = source.map((asset) => asset.id);
    const result = filterAssets(
      parseSearchFilters(
        params("q=ridge&type=banner&category=texture&sort=title-asc"),
        searchContext,
      ),
      source,
    );

    expect(result.map((asset) => asset.slug)).toEqual(["basal-ridges"]);
    expect(source.map((asset) => asset.id)).toEqual(before);
  });

  it("sorts with truthful supported options", () => {
    expect(
      filterAssets(
        parseSearchFilters(params("type=icon&sort=title-desc"), searchContext),
      )
        .slice(0, 3)
        .map((asset) => asset.slug),
    ).toEqual(["soft-link", "small-halo", "ridge-stack"]);
  });
});

describe("orientation and color taxonomy", () => {
  it("derives orientation from dimensions", () => {
    expect(
      getOrientation(seedAssets.find((asset) => asset.kind === "pfp")!),
    ).toBe("square");
    expect(
      getOrientation(seedAssets.find((asset) => asset.kind === "banner")!),
    ).toBe("landscape");
  });

  it("maps palette values into deterministic color families", () => {
    expect(colorFamilyForHex("#050505")).toBe("black");
    expect(colorFamilyForHex("#f7f7f2")).toBe("white");
    expect(colorFamilyForHex("#777777")).toBe("gray");
    expect(colorFamilyForHex("#3f638f")).toBe("blue");
    expect(colorFamiliesForAsset(seedAssets[0])).toContain("multicolor");
  });
});

describe("filter links and taxonomy validation", () => {
  it("generates active filter removal and reset URLs", () => {
    const filters = parseSearchFilters(
      params("q=dark&type=pfp&category=dark&tag=warm&sort=oldest"),
      searchContext,
    );
    const chips = activeFilters(filters, searchContext);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Search: dark",
      "Type: pfp",
      "Category: Dark",
      "Tag: warm",
      "Sort: Oldest",
    ]);
    expect(chips.find((chip) => chip.key === "tag")?.href).toBe(
      "/search?q=dark&type=pfp&category=dark&sort=oldest",
    );
    expect(getResetUrl(searchContext)).toBe("/search");
  });

  it("pluralizes result counts", () => {
    expect(pluralizeResults(1)).toBe("1 result");
    expect(pluralizeResults(24)).toBe("24 results");
  });

  it("validates the committed taxonomy", () => {
    expect(validateTaxonomy()).toEqual([]);
  });

  it("detects invalid duplicate normalized tags through filter expectations", () => {
    const invalid = {
      ...seedAssets[0],
      tags: ["Soft Link", "soft-link"],
    } satisfies SeedAsset;

    expect(new Set(invalid.tags.map(normalizeToken)).size).toBeLessThan(
      invalid.tags.length,
    );
  });
});
