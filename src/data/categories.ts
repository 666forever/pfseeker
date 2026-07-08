import type { AssetKind } from "@/lib/media";

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  kinds: AssetKind[];
}

export const seedCategories = [
  {
    slug: "dark",
    name: "Dark",
    description:
      "Low-light compositions with deep contrast and restrained color.",
    kinds: ["pfp"],
  },
  {
    slug: "minimal",
    name: "Minimal",
    description:
      "Quiet images built around clean shapes, negative space, and simple palettes.",
    kinds: ["pfp", "icon"],
  },
  {
    slug: "monochrome",
    name: "Monochrome",
    description:
      "Black, white, and near-neutral imagery for focused profile systems.",
    kinds: ["pfp", "banner", "icon"],
  },
  {
    slug: "abstract",
    name: "Abstract",
    description:
      "Geometric, atmospheric, and nonliteral visuals with strong composition.",
    kinds: ["pfp", "banner"],
  },
  {
    slug: "character",
    name: "Character",
    description:
      "Original figure-led profile images without borrowed franchise identity.",
    kinds: ["pfp"],
  },
  {
    slug: "photography",
    name: "Photography",
    description:
      "Photo-inspired profile imagery using original staged scenes and textures.",
    kinds: ["pfp"],
  },
  {
    slug: "atmospheric",
    name: "Atmospheric",
    description:
      "Wide scenes with soft depth, haze, and cinematic profile-banner mood.",
    kinds: ["banner"],
  },
  {
    slug: "landscape",
    name: "Landscape",
    description:
      "Expansive horizontal compositions suitable for profile headers.",
    kinds: ["banner"],
  },
  {
    slug: "texture",
    name: "Texture",
    description: "Surface-led banner imagery with tactile rhythm and detail.",
    kinds: ["banner"],
  },
  {
    slug: "interface",
    name: "Interface",
    description:
      "Small symbols and utility marks designed for clear interface use.",
    kinds: ["icon"],
  },
  {
    slug: "social",
    name: "Social",
    description:
      "Compact marks for identity, presence, and profile-link contexts.",
    kinds: ["icon"],
  },
  {
    slug: "symbols",
    name: "Symbols",
    description:
      "Simple standalone signs with crisp silhouettes and readable geometry.",
    kinds: ["icon"],
  },
] satisfies SeedCategory[];

export function getCategoriesForKind(kind: AssetKind): SeedCategory[] {
  return seedCategories.filter((category) => category.kinds.includes(kind));
}

export function getCategory(slug: string): SeedCategory | undefined {
  return seedCategories.find((category) => category.slug === slug);
}

export function getCategoryForKind(
  kind: AssetKind,
  slug: string,
): SeedCategory | undefined {
  const category = getCategory(slug);
  return category?.kinds.includes(kind) ? category : undefined;
}
