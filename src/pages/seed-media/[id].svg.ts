import type { APIRoute } from "astro";

import { getAssetById } from "@/data/discovery";
import type { SeedAsset } from "@/data/assets";

const motifMarkup = {
  arc: (asset: SeedAsset) => `
    <path d="M ${asset.width * 0.12} ${asset.height * 0.72} C ${asset.width * 0.35} ${asset.height * 0.22}, ${asset.width * 0.62} ${asset.height * 0.18}, ${asset.width * 0.88} ${asset.height * 0.66}" fill="none" stroke="${asset.palette[1]}" stroke-width="${asset.width * 0.045}" stroke-linecap="round" opacity="0.9"/>
    <circle cx="${asset.width * 0.68}" cy="${asset.height * 0.36}" r="${Math.min(asset.width, asset.height) * 0.13}" fill="${asset.palette[2]}" opacity="0.86"/>
  `,
  beam: (asset: SeedAsset) => `
    <rect x="${asset.width * 0.1}" y="${asset.height * 0.42}" width="${asset.width * 0.8}" height="${asset.height * 0.12}" rx="${asset.height * 0.04}" fill="${asset.palette[1]}" opacity="0.9"/>
    <rect x="${asset.width * 0.48}" y="${asset.height * 0.12}" width="${asset.width * 0.08}" height="${asset.height * 0.76}" rx="${asset.width * 0.02}" fill="${asset.palette[2]}" opacity="0.82"/>
  `,
  grid: (asset: SeedAsset) => `
    <g stroke="${asset.palette[1]}" stroke-width="${Math.max(3, asset.width * 0.01)}" opacity="0.7">
      <path d="M ${asset.width * 0.22} ${asset.height * 0.18} V ${asset.height * 0.82}"/>
      <path d="M ${asset.width * 0.5} ${asset.height * 0.12} V ${asset.height * 0.88}"/>
      <path d="M ${asset.width * 0.78} ${asset.height * 0.18} V ${asset.height * 0.82}"/>
      <path d="M ${asset.width * 0.12} ${asset.height * 0.34} H ${asset.width * 0.88}"/>
      <path d="M ${asset.width * 0.12} ${asset.height * 0.62} H ${asset.width * 0.88}"/>
    </g>
    <rect x="${asset.width * 0.36}" y="${asset.height * 0.34}" width="${asset.width * 0.28}" height="${asset.height * 0.28}" rx="${asset.width * 0.04}" fill="${asset.palette[2]}" opacity="0.82"/>
  `,
  halo: (asset: SeedAsset) => `
    <circle cx="${asset.width * 0.5}" cy="${asset.height * 0.5}" r="${Math.min(asset.width, asset.height) * 0.28}" fill="none" stroke="${asset.palette[1]}" stroke-width="${Math.min(asset.width, asset.height) * 0.05}" opacity="0.92"/>
    <circle cx="${asset.width * 0.56}" cy="${asset.height * 0.44}" r="${Math.min(asset.width, asset.height) * 0.12}" fill="${asset.palette[2]}" opacity="0.88"/>
  `,
  ridge: (asset: SeedAsset) => `
    <g fill="none" stroke-linecap="round" stroke-width="${Math.max(5, asset.height * 0.035)}">
      <path d="M ${asset.width * 0.12} ${asset.height * 0.64} C ${asset.width * 0.28} ${asset.height * 0.48}, ${asset.width * 0.42} ${asset.height * 0.76}, ${asset.width * 0.58} ${asset.height * 0.58} S ${asset.width * 0.82} ${asset.height * 0.5}, ${asset.width * 0.9} ${asset.height * 0.34}" stroke="${asset.palette[1]}" opacity="0.9"/>
      <path d="M ${asset.width * 0.1} ${asset.height * 0.78} C ${asset.width * 0.3} ${asset.height * 0.58}, ${asset.width * 0.48} ${asset.height * 0.86}, ${asset.width * 0.68} ${asset.height * 0.66} S ${asset.width * 0.86} ${asset.height * 0.62}, ${asset.width * 0.94} ${asset.height * 0.48}" stroke="${asset.palette[2]}" opacity="0.68"/>
    </g>
  `,
  signal: (asset: SeedAsset) => `
    <circle cx="${asset.width * 0.5}" cy="${asset.height * 0.5}" r="${Math.min(asset.width, asset.height) * 0.08}" fill="${asset.palette[2]}"/>
    <g fill="none" stroke="${asset.palette[1]}" stroke-width="${Math.min(asset.width, asset.height) * 0.035}" stroke-linecap="round" opacity="0.88">
      <path d="M ${asset.width * 0.34} ${asset.height * 0.36} C ${asset.width * 0.43} ${asset.height * 0.27}, ${asset.width * 0.57} ${asset.height * 0.27}, ${asset.width * 0.66} ${asset.height * 0.36}"/>
      <path d="M ${asset.width * 0.25} ${asset.height * 0.25} C ${asset.width * 0.39} ${asset.height * 0.1}, ${asset.width * 0.61} ${asset.height * 0.1}, ${asset.width * 0.75} ${asset.height * 0.25}"/>
      <path d="M ${asset.width * 0.34} ${asset.height * 0.64} C ${asset.width * 0.43} ${asset.height * 0.73}, ${asset.width * 0.57} ${asset.height * 0.73}, ${asset.width * 0.66} ${asset.height * 0.64}"/>
    </g>
  `,
  spark: (asset: SeedAsset) => `
    <path d="M ${asset.width * 0.5} ${asset.height * 0.14} L ${asset.width * 0.58} ${asset.height * 0.42} L ${asset.width * 0.86} ${asset.height * 0.5} L ${asset.width * 0.58} ${asset.height * 0.58} L ${asset.width * 0.5} ${asset.height * 0.86} L ${asset.width * 0.42} ${asset.height * 0.58} L ${asset.width * 0.14} ${asset.height * 0.5} L ${asset.width * 0.42} ${asset.height * 0.42} Z" fill="${asset.palette[1]}" opacity="0.94"/>
    <circle cx="${asset.width * 0.5}" cy="${asset.height * 0.5}" r="${Math.min(asset.width, asset.height) * 0.08}" fill="${asset.palette[2]}"/>
  `,
  wave: (asset: SeedAsset) => `
    <path d="M 0 ${asset.height * 0.58} C ${asset.width * 0.18} ${asset.height * 0.42}, ${asset.width * 0.32} ${asset.height * 0.76}, ${asset.width * 0.5} ${asset.height * 0.58} S ${asset.width * 0.82} ${asset.height * 0.38}, ${asset.width} ${asset.height * 0.54} V ${asset.height} H 0 Z" fill="${asset.palette[1]}" opacity="0.82"/>
    <path d="M 0 ${asset.height * 0.72} C ${asset.width * 0.2} ${asset.height * 0.56}, ${asset.width * 0.36} ${asset.height * 0.88}, ${asset.width * 0.55} ${asset.height * 0.68} S ${asset.width * 0.82} ${asset.height * 0.52}, ${asset.width} ${asset.height * 0.68}" fill="none" stroke="${asset.palette[2]}" stroke-width="${Math.max(4, asset.height * 0.035)}" opacity="0.78"/>
  `,
};

function svgForAsset(asset: SeedAsset): string {
  const [background, primary, secondary] = asset.palette;
  const radius =
    asset.kind === "banner" ? 36 : asset.kind === "icon" ? 96 : 128;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${asset.width}" height="${asset.height}" viewBox="0 0 ${asset.width} ${asset.height}" role="img" aria-labelledby="title desc">
  <title id="title">${asset.title}</title>
  <desc id="desc">${asset.alt}</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${background}"/>
      <stop offset="0.62" stop-color="${primary}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${background}"/>
    </linearGradient>
    <radialGradient id="glow" cx="66%" cy="34%" r="62%">
      <stop offset="0" stop-color="${secondary}" stop-opacity="0.48"/>
      <stop offset="0.44" stop-color="${primary}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${background}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="clip"><rect width="${asset.width}" height="${asset.height}" rx="${radius}"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="${asset.width}" height="${asset.height}" fill="url(#bg)"/>
    <rect width="${asset.width}" height="${asset.height}" fill="url(#glow)"/>
    ${motifMarkup[asset.motif](asset)}
    <rect x="${asset.width * 0.04}" y="${asset.height * 0.04}" width="${asset.width * 0.92}" height="${asset.height * 0.92}" rx="${radius * 0.72}" fill="none" stroke="${secondary}" stroke-opacity="0.16" stroke-width="${Math.max(2, Math.min(asset.width, asset.height) * 0.012)}"/>
  </g>
</svg>`;
}

export const GET: APIRoute = ({ params }) => {
  const id = params.id?.replace(/\.svg$/, "") ?? "";
  const asset = getAssetById(id);

  if (!asset) {
    return new Response("Seed media not found", { status: 404 });
  }

  return new Response(svgForAsset(asset), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
};
