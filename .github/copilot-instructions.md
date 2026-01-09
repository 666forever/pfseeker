# PFSeeker — AI Agent Instructions

## Project Overview
**PFSeeker** is a vanilla JavaScript (ES6 modules) single-page application (SPA) for browsing, filtering, and managing image galleries (profile pictures and banners). Zero frameworks, client-side routing, responsive infinite-scroll masonry, and a detail view for images with tag-based similarity suggestions.

---

## Architecture & Data Flow

### Core SPA Structure
- **Entry:** `index.html` (shell with inline SVG sprite, gallery container, detail page overlay)
- **Routing:** `router.js` — client-side router matching exact and dynamic routes (e.g., `/pfps/:filename`); handles history API and nav highlighting
- **App Logic:** `script.js` — state management, gallery rendering, search, like functionality, detail page orchestration
- **Imports:** Both `pfps/images_list.js` and `banners/images_list.js` as ES6 modules (each exports `{ pfpImages }` and `{ bannerImages }` arrays with `{ file, tags }` properties)

### Navigation Routes
```javascript
'/'             → Home (mixed explore feed)
'/pfps'         → PFP gallery
'/banners'      → Banner gallery
'/explore'      → Shuffle view (combined)
'/liked'        → Liked images (localStorage)
'/pfps/:filename' → Detail page for PFP
'/banners/:filename' → Detail page for banner
```

### State Management (Module-Scoped Globals)
- `pageType` — "pfp" or "banner" (current section)
- `viewMode` — "normal" | "liked" | "explore" (gallery source)
- `activeTag` — currently filtered tag or "all"
- `likedImages` — Set of `${type}/${filename}` keys, persisted to localStorage
- `exploreImages`, `shuffledPfpImages`, `shuffledBannerImages` — precomputed arrays (one per session)

### Image Array Structure
```javascript
// From images_list.js
{
  file: "image_name.jpg",        // Filename (used for routing and asset paths)
  tags: ["dark", "aesthetic", "nature"]  // Search/filter keywords
}
```

---

## Critical Patterns & Workflows

### Asset URL Resolution
**Problem:** Module-relative paths break after page refresh (e.g., `/pfps/images/name.jpg`).  
**Solution:** Use `assetUrl(path)` helper defined in `script.js`:
```javascript
const ASSET_BASE = new URL('.', import.meta.url);
function assetUrl(path) {
  return new URL(path, ASSET_BASE).href;  // Returns absolute module-relative URL
}

// Usage:
const src = assetUrl(`pfps/images/${filename}`);  // → file:///path/to/pfps/images/name.jpg
```

### Gallery Rendering (Infinite Scroll + Masonry)
1. **Column System:** Creates `COLUMN_COUNT` flex-column divs (responsive: 3–7 cols based on viewport)
2. **Batch Loading:** Loads `BATCH_SIZE` images per batch (base 12 rows × column count)
3. **Infinite Scroll:** IntersectionObserver watches a sentinel div; loads next batch when user scrolls near
4. **Image Priority:** First 6 images set `fetchPriority="high"`; all use `loading="lazy"` and `decoding="async"`
5. **Staggered Animation:** Cards fade-in with `--enter-delay` CSS variable (0–175ms offset by row)

### Search & Filter Flow
1. User types in `#searchInput` → `showTagSuggestions()` aggregates tags from both pfp/banner, shows top 11
2. User clicks tag or presses Enter → `executeSearch(query)` filters images by filename/tag, sets `activeSearch.searchSource`
3. `getImageSource()` checks `activeSearch.searchSource` first (if active); gallery resets and loads only matches
4. Clear button resets state: `clearSearchDivider()` nullifies search, restores full gallery

### Similar Images (Detail Page)
1. User clicks image card (or enlarge icon) → `showImageDetail(filename, type)` opens overlay
2. `loadSimilarImages(tags)` finds all images sharing ≥1 tag, sorts by match count descending (up to 12 total)
3. `renderSimilarImages()` renders into `#similarGrid` (CSS Grid: auto-fill, minmax 180px)
4. User clicks similar image → navigates to its detail route (preserves `previousRoute` for back button)

### Like Functionality
- **Toggle:** `toggleLike(filename, type)` adds/removes `${type}/${filename}` from `likedImages` Set
- **Storage:** Persisted to `localStorage` after each change
- **UI Sync:** Icon swapped between `#icon-heart-outline` and `#icon-heart-filled`; `.liked` class applied
- **Liked View:** Route `/liked` sources images from all stored keys, ignoring filters

### Event Delegation Pattern
- Gallery click handler uses `.closest()` to catch **like**, **enlarge**, or **image** clicks
- Detail page has separate click handlers (like, download, dots) attached to specific button IDs
- Global Escape/click-outside handlers close modals, panels, dropdowns (consolidated in single listeners)

---

## CSS Architecture

### Design Tokens (47 Variables in `:root`)
All colors, spacing, and semantic meanings defined in `css/styles.css` lines 7–50. Key tokens:
- **`--bg-*`**: base, elevated, overlay, hover, active
- **`--text-*`**: primary, secondary, tertiary, disabled
- **`--border-*`**: subtle, medium, strong (rgba opacity variants)
- **`--accent-*`**: primary, hover, active (desaturated blues)
- **`--interactive-*`**: hover, active, focus overlays
- **`--semantic-like`**: #E85D5D (desaturated red for heart)

### Key Component Styles
- **`.card`**: Gallery item with absolute like/enlarge buttons; opacity/transform entrance animation
- **`.column`**: flex-direction: column child of `.gallery` (masonry column)
- **`.similar-card`**: Square aspect-ratio cards (1:1) in detail page grid
- **`.search-row`**: Fixed search bar with filter dropdown and results panel
- **`.detail-content`**: 7-column grid layout (main image + similar images panel)

### Responsive Breakpoints
- **≤500px:** 3 columns, reduced padding, mobile detail layout
- **≤900px:** 4 columns
- **≤1400px:** 5 columns
- **>1400px:** 7 columns

---

## Common Development Tasks

### Adding a New Page/Route
1. Define route in `script.js`: `router.addRoute('/path', (params) => { /* logic */ })`
2. If dynamic (with params): use pattern `/path/:paramName`; params passed as object to callback
3. Call `hideImageDetail()` at start if route shouldn't show detail overlay
4. Call `resetGallery()` if route needs gallery display
5. Update sidebar nav in `components/sidebar.html` with `data-route` attribute

### Modifying the Gallery Layout
- **Columns:** Adjust breakpoints in `getColumnCount()` (script.js line ~58)
- **Batch size:** Change `BATCH_SIZE_BASE` (currently 12 rows) in script.js
- **Cards appearance:** Edit `.card`, `.column` in styles.css (~lines 470–620)

### Adding a New Tag Filter
1. Tags are automatically extracted from image metadata in `images_list.js`
2. Hardcoded filter options in `createFilterOptions()` (script.js ~line 115) add quick buttons
3. Search automatically includes all tags from images

### Detail Page Customization
- Main layout: `.detail-content` (7-col grid) in styles.css ~line 900
- Similar section: `.detail-similar` and `.similar-grid` in styles.css ~line 1042
- Action buttons: `.detail-actions` in styles.css ~line 920
- Preserve commented `.detail-tags` block (lines 983–1062 in styles.css) for future tag display UI

---

## Important Files & Their Roles

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 235 | SPA shell, SVG sprite, layout containers |
| `script.js` | 1322 | Core state, gallery render, search, routing callbacks |
| `router.js` | 135 | Client-side router, route matching, history API |
| `css/styles.css` | 1109 | All UI styles, tokens, animations, responsive |
| `css/sidebar.css` | ~100 | Sidebar navigation styling |
| `js/sidebar-loader.js` | 91 | Injects sidebar.html, highlights active link |
| `components/sidebar.html` | 46 | Nav markup with SVG icons |
| `pfps/images_list.js` | auto-generated | Array of PFP metadata |
| `banners/images_list.js` | auto-generated | Array of banner metadata |

---

## Code Quality Standards

### Naming Conventions
- **Functions:** verb + noun: `loadSimilarImages()`, `renderSimilarImages()`, `showImageDetail()`
- **Events:** `addEventListener()` for element-specific, global delegation for gallery clicks
- **State variables:** camelCase for module-scoped; `const`/`let` (no `var`)
- **CSS classes:** kebab-case: `.similar-card`, `.search-row`, `.detail-content`

### Error Handling
- Use `?.` optional chaining and `?.addEventListener()` on potentially null elements
- Add null checks before DOM queries: `if (element) { ... }`
- Avoid console.log in production; use `console.error()` for actual errors only
- Graceful degradation: if image fails to load, card still renders with visibility class

### Performance
- Lazy load images: `loading="lazy"`, `decoding="async"`
- Batch render: limit to 12 rows per batch, debounce resize events (150ms)
- Use `Set` for O(1) lookups (liked images, loaded images)
- RequestAnimationFrame for smooth scroll handling in IntersectionObserver

### No Magic Numbers
- Use constants: `SIMILAR_IMAGES_LIMIT`, `BATCH_LOAD_DELAY`, `INFINITE_SCROLL_MARGIN`
- Define at module level for discoverability

---

## Testing & Debugging

### Local Development
- No build step required; serve via HTTP (local server or Cloudflare Pages)
- All assets use relative paths via `assetUrl()`
- Open DevTools → Network/Console to verify:
  - ✅ No 404s on image loads
  - ✅ No undefined CSS variables
  - ✅ Route parameters extracted correctly

### Common Issues
- **Images don't load:** Check `assetUrl()` returns correct path; verify `pfps/images/` and `banners/images/` directories exist
- **Styles undefined:** Ensure CSS variable is defined in `:root` or applicable scope
- **Routes 404:** Verify route pattern in `router.addRoute()` matches actual path structure
- **Detail page blank:** Check `loadSimilarImages()` receives valid tags array; verify similar images render

---

## Deploy Notes
- Hosted on Cloudflare Pages via GitHub Actions
- `.htaccess` handles client-side routing rewrites (SPA mode)
- No server-side code; all logic runs in browser
- localStorage persists likes across sessions (no backend sync)

