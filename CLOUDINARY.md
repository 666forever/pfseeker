# Cloudinary Media Boundary

Phase 4 centralizes pfseeker media URL generation in `src/lib/media.ts`.

## Environment

Browser-safe configuration:

- `PUBLIC_CLOUDINARY_CLOUD_NAME`

Server-only configuration:

- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The media helper reads only `PUBLIC_CLOUDINARY_CLOUD_NAME`. API keys, API secrets, upload signatures, and privileged upload behavior must remain in future server-side modules.

## Stable Data

Persist stable media metadata:

- Cloudinary public ID
- media kind: `pfp`, `banner`, or `icon`
- intrinsic width and height
- alt text
- original format when known
- animation state when known
- optional Cloudinary version

Do not persist transformed Cloudinary URLs. Generate transformed delivery URLs from stable public IDs at render time.

## Public ID Rules

Public IDs are treated as relative Cloudinary paths:

- no leading slash
- no empty path segments
- no `.` or `..` segments
- no backslashes
- no URL protocols

Each path segment is URL encoded while preserving Cloudinary folder separators.

## Transform Order

URL transformations are emitted in a deterministic order:

1. quality
2. format
3. width
4. height
5. crop
6. gravity
7. DPR
8. page
9. effect
10. flags

This keeps tests stable and makes URL diffs readable.

## Presets

The helper exposes kind-aware presets:

- `pfp`: automatic quality and format, fill crop, auto gravity
- `banner`: automatic quality and format, fill crop, auto gravity
- `icon`: automatic quality and format, fit crop

Responsive defaults are intentionally conservative. Phase 5 gallery layouts provide explicit width candidates and `sizes` values through the seed discovery helpers.

## Responsive Descriptor

`buildResponsiveImage()` returns:

- `src`
- `srcset`
- `sizes`
- `alt`
- intrinsic `width` and `height`
- CSS-ready `aspectRatio`
- low-width blurred placeholder URL
- original download URL

The descriptor is data-only. Phase 5 gallery components consume centralized media helpers without reimplementing Cloudinary URL construction.

## Local Seed Media

Phase 5 uses generated local SVG media because no real pfseeker Cloudinary inventory exists in the repository yet.

Local media is development-only and is isolated behind `buildLocalResponsiveImage()` and `buildSeedImageDescriptor()`. Gallery components still receive the same descriptor shape as Cloudinary-backed media, so replacing local sources with stable Cloudinary public IDs should not require rewriting gallery markup.

## Original Downloads

Original-download URLs use Cloudinary's attachment flag and do not include responsive transforms, automatic format conversion, or automatic quality compression.

Future server behavior must validate download permissions and record download events before exposing protected original-download flows.
