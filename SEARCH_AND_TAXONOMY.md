# Search and Taxonomy

Phase 8 expands pfseeker seed discovery into a server-rendered, URL-addressable filter system. It uses the current seed dataset only and does not invent popularity, trending, ownership, creator, download-count, or engagement data.

## Query Parameters

The primary route is `/search`.

Supported parameters:

- `q`: free-text query.
- `type`: `all`, `pfp`, `banner`, `icon`.
- `category`: compatible category slug.
- `tag`: exact normalized seed tag.
- `format`: `all`, `svg`.
- `animation`: `all`, `static`, `animated`.
- `orientation`: `all`, `square`, `landscape`, `portrait`.
- `color`: `all`, `black`, `white`, `gray`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`, `multicolor`.
- `sort`: `newest`, `oldest`, `title-asc`, `title-desc`.

Unknown parameters are ignored. Empty and invalid supported values fall back to defaults. Repeated parameters use the first non-empty value.

## Canonicalization

The canonical parameter order is:

1. `q`
2. `type`
3. `category`
4. `tag`
5. `format`
6. `animation`
7. `orientation`
8. `color`
9. `sort`

Default values are omitted. For example, `type=all` and `sort=newest` are not serialized.

Gallery routes use fixed type context, so `/pfps?type=banner` normalizes as profile-picture filtering. Category routes use fixed category context, so route category state is not duplicated as a query parameter.

## Matching Semantics

Free-text search normalizes whitespace and is case-insensitive. Every term must match. Matching checks:

- asset title
- asset kind
- alt text
- tags
- category slugs
- category names

There is no fuzzy-search dependency. This keeps results deterministic and avoids broad surprising matches.

## Filtering Order

The shared pipeline is:

1. normalize query state
2. free-text match
3. type
4. category
5. tag
6. format
7. animation
8. orientation
9. color
10. sort

The seed asset array is never mutated.

## Type and Category Compatibility

Categories are offered only when compatible with the selected type. If a type/category pair is incompatible, the category is ignored during normalization.

Examples:

- `type=pfp&category=dark` is valid.
- `type=icon&category=landscape` normalizes by ignoring `landscape`.

Category pages keep the route category fixed and allow additional compatible filters such as `animation`, `tag`, `format`, `orientation`, `color`, and `sort`.

## Tag Normalization

Tags are exact normalized tokens. Whitespace is trimmed, case is lowered, and internal spaces normalize to hyphens. Detail-page tag links now point to `/search?tag=...`.

## Orientation

Orientation is derived from dimensions:

- equal width and height: `square`
- width greater than height: `landscape`
- height greater than width: `portrait`

No redundant orientation metadata is stored in seed records.

## Color Families

Seed assets include palette metadata. pfseeker maps those palette values into restrained color families using deterministic HSL thresholds:

- very dark colors map to `black`
- very light low-to-moderate saturation colors map to `white`
- low saturation colors map to `gray`
- hue ranges map chromatic values to red, orange, yellow, green, cyan, blue, purple, or pink
- assets with three or more distinct families, or two or more chromatic families, also include `multicolor`

This is categorical seed metadata, not exact image analysis.

## Sorting

Supported sorts are truthful for the seed data:

- `newest`
- `oldest`
- `title-asc`
- `title-desc`

There is no popularity, trending, most-downloaded, or most-saved sort.

## Indexing Policy

Arbitrary `/search` filter combinations use `noindex, follow`.

Gallery and valid category pages remain indexable. Their canonical URLs normalize filter parameter order and remove defaults.

## Accessibility

The filter interface is a GET form with labeled controls and native selects. Active filters are regular links with removal labels, reset-all is a normal link, no-results content is in document flow, and the layout stacks on mobile without horizontal overflow. Filtering does not require JavaScript.

## Migration Path

The current implementation filters in-memory seed records. D1-backed search should keep the same URL contract, normalization behavior, truthful sort set, type/category compatibility rules, tag normalization, and indexing policy while moving filtering into repository/query helpers.
