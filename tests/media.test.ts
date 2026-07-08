import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildCloudinaryImageUrl,
  buildCloudinaryTransform,
  buildMediaPreviewUrl,
  buildOriginalDownloadUrl,
  buildResponsiveImage,
  encodeCloudinaryPublicId,
  getPublicCloudinaryConfig,
  type PfseekerMediaAsset,
} from "@/lib/media";

const cloudName = "pfseeker-test";
const pfpAsset = {
  kind: "pfp",
  publicId: "pfseeker/pfps/neon avatar",
  alt: "Neon avatar portrait",
  width: 1024,
  height: 1024,
  format: "gif",
  animation: "animated",
  version: 42,
} satisfies PfseekerMediaAsset;

const bannerAsset = {
  kind: "banner",
  publicId: "pfseeker/banners/orbit",
  alt: "Orbit banner",
  width: 1600,
  height: 640,
  format: "jpg",
  animation: "static",
} satisfies PfseekerMediaAsset;

describe("Cloudinary media boundary", () => {
  it("reads only the public Cloudinary cloud name", () => {
    expect(
      getPublicCloudinaryConfig({
        PUBLIC_CLOUDINARY_CLOUD_NAME: ` ${cloudName} `,
      }),
    ).toEqual({ cloudName });
  });

  it("encodes stable public IDs without accepting unsafe paths", () => {
    expect(encodeCloudinaryPublicId("pfseeker/icons/dark spark")).toBe(
      "pfseeker/icons/dark%20spark",
    );
    expect(() => encodeCloudinaryPublicId("../secret")).toThrow(
      "relative, non-empty path",
    );
    expect(() => encodeCloudinaryPublicId("https://example.test/file")).toThrow(
      "relative, non-empty path",
    );
  });

  it("builds deterministic transformed PFP URLs", () => {
    expect(
      buildCloudinaryImageUrl({
        cloudName,
        publicId: pfpAsset.publicId,
        version: pfpAsset.version,
        quality: "auto",
        format: "auto",
        width: 320,
        height: 320,
        crop: "fill",
        gravity: "auto",
        dpr: 2,
      }),
    ).toBe(
      "https://res.cloudinary.com/pfseeker-test/image/upload/q_auto,f_auto,w_320,h_320,c_fill,g_auto,dpr_2/v42/pfseeker/pfps/neon%20avatar",
    );
  });

  it("builds preset preview URLs for animated assets", () => {
    expect(
      buildMediaPreviewUrl(pfpAsset, {
        cloudName,
        width: 240,
        page: 1,
      }),
    ).toBe(
      "https://res.cloudinary.com/pfseeker-test/image/upload/q_auto,f_auto,w_240,c_fill,g_auto,pg_1/v42/pfseeker/pfps/neon%20avatar",
    );
  });

  it("builds responsive descriptors with stable dimensions and placeholders", () => {
    expect(
      buildResponsiveImage(bannerAsset, {
        cloudName,
        widths: [1280, 640],
        sizes: "(min-width: 960px) 960px, 100vw",
      }),
    ).toEqual({
      src: "https://res.cloudinary.com/pfseeker-test/image/upload/q_auto,f_auto,w_1280,c_fill,g_auto/pfseeker/banners/orbit",
      srcset:
        "https://res.cloudinary.com/pfseeker-test/image/upload/q_auto,f_auto,w_640,c_fill,g_auto/pfseeker/banners/orbit 640w, https://res.cloudinary.com/pfseeker-test/image/upload/q_auto,f_auto,w_1280,c_fill,g_auto/pfseeker/banners/orbit 1280w",
      sizes: "(min-width: 960px) 960px, 100vw",
      alt: "Orbit banner",
      width: 1600,
      height: 640,
      aspectRatio: "1600 / 640",
      placeholder:
        "https://res.cloudinary.com/pfseeker-test/image/upload/q_30,f_auto,w_32,c_fill,g_auto,e_blur:1000/pfseeker/banners/orbit",
      downloadUrl:
        "https://res.cloudinary.com/pfseeker-test/image/upload/fl_attachment/pfseeker/banners/orbit",
    });
  });

  it("builds original download URLs without responsive transformations", () => {
    expect(
      buildOriginalDownloadUrl(pfpAsset, {
        cloudName,
        filename: "neon avatar.gif",
      }),
    ).toBe(
      "https://res.cloudinary.com/pfseeker-test/image/upload/fl_attachment:neon-avatar.gif/v42/pfseeker/pfps/neon%20avatar",
    );
  });

  it("rejects missing config and invalid transform dimensions", () => {
    expect(() =>
      buildCloudinaryImageUrl({
        publicId: pfpAsset.publicId,
        width: 320,
      }),
    ).toThrow("PUBLIC_CLOUDINARY_CLOUD_NAME");
    expect(() => buildCloudinaryTransform({ width: 0 })).toThrow(
      "width must be a positive integer",
    );
    expect(() => buildCloudinaryTransform({ quality: 101 })).toThrow(
      "quality must be 100 or less",
    );
  });

  it("does not reference server-side Cloudinary secrets", () => {
    const sourcePath = fileURLToPath(
      new URL("../src/lib/media.ts", import.meta.url),
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("CLOUDINARY_API_KEY");
    expect(source).not.toContain("CLOUDINARY_API_SECRET");
  });
});
