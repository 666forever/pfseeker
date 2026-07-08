import { describe, expect, it } from "vitest";

import { normalizeSiteUrl } from "@/lib/config";
import { isEscapeKey, nextFocusableIndex } from "@/lib/focus";
import {
  canonicalUrl,
  footerGroups,
  getActiveNavHref,
  isActivePath,
  parseSearchQuery,
  primaryNavItems,
  titleTemplate,
} from "@/lib/shell";

describe("normalizeSiteUrl", () => {
  it("uses the production site URL when no value is provided", () => {
    expect(normalizeSiteUrl(undefined)).toBe("https://pfseeker.com");
  });

  it("removes trailing slash, search, and hash fragments", () => {
    expect(normalizeSiteUrl("https://pfseeker.com/path/?x=1#top")).toBe(
      "https://pfseeker.com/path",
    );
  });
});

describe("shell navigation", () => {
  it("uses the required public routes", () => {
    expect(primaryNavItems).toEqual([
      { label: "Home", href: "/" },
      { label: "Profile Pictures", href: "/pfps" },
      { label: "Banners", href: "/banners" },
      { label: "Icons", href: "/icons" },
      { label: "Collections", href: "/collections" },
    ]);
  });

  it("matches active routes without overmatching home", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/pfps", "/")).toBe(false);
    expect(isActivePath("/pfps/anime", "/pfps")).toBe(true);
    expect(getActiveNavHref("/collections/saved")).toBe("/collections");
  });

  it("keeps footer links grouped by real public routes", () => {
    expect(
      footerGroups.flatMap((group) => group.links.map((link) => link.href)),
    ).toEqual([
      "/pfps",
      "/banners",
      "/icons",
      "/collections",
      "/about",
      "/faq",
      "/privacy",
      "/terms",
    ]);
  });
});

describe("shell metadata and search parsing", () => {
  it("builds canonical URLs and page titles", () => {
    expect(canonicalUrl("/pfps/")).toBe("https://pfseeker.com/pfps");
    expect(titleTemplate("Banners")).toBe("Banners | pfseeker");
    expect(titleTemplate("pfseeker")).toBe("pfseeker");
  });

  it("trims and limits search queries", () => {
    expect(parseSearchQuery(new URLSearchParams("q=%20dark%20icons%20"))).toBe(
      "dark icons",
    );
    expect(
      parseSearchQuery(new URLSearchParams(`q=${"a".repeat(150)}`)),
    ).toHaveLength(120);
  });
});

describe("overlay focus helpers", () => {
  it("wraps focus forward and backward", () => {
    expect(nextFocusableIndex(2, 3, 1)).toBe(0);
    expect(nextFocusableIndex(0, 3, -1)).toBe(2);
  });

  it("returns -1 when there are no focusable controls", () => {
    expect(nextFocusableIndex(0, 0, 1)).toBe(-1);
  });

  it("detects Escape key presses", () => {
    expect(isEscapeKey({ key: "Escape" })).toBe(true);
    expect(isEscapeKey({ key: "Enter" })).toBe(false);
  });
});
