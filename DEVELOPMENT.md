# PFSeeker Development Guidelines

## Code Editing Rules

### **NEVER REWRITE ENTIRE FILES**
When making changes to existing files:
- ✅ **DO:** Use `Filesystem:edit_file` to make surgical, targeted edits
- ✅ **DO:** Find the exact text block that needs changing and replace only that section
- ✅ **DO:** If exact match fails, read the specific section first to get precise text
- ❌ **DON'T:** Rewrite entire files from top to bottom
- ❌ **DON'T:** Use `Filesystem:write_file` on existing files unless absolutely necessary

### File Modification Workflow
1. Read the relevant section of the file first
2. Identify the exact text block to modify
3. Use `edit_file` with precise old_str and new_str
4. If match fails, re-read to verify exact formatting
5. Only as last resort: ask before rewriting entire file

## Project Architecture

### Tech Stack
- Vanilla JavaScript (ES6 modules) - NO frameworks
- Client-side routing (router.js)
- Inline SVG icons (no external CDN dependencies for icons)
- Responsive masonry layout with infinite scroll
- Cloudflare Pages deployment via GitHub

### File Structure
```
root/
├── index.html
├── router.js
├── script.js
├── .htaccess
├── css/
│   ├── styles.css
│   └── sidebar.css
├── js/
│   ├── sidebar-loader.js
│   └── featured_tags.js
├── components/
│   └── sidebar.html
├── pfps/
│   ├── images_list.js
│   └── images/
├── banners/
│  ├── images_list.js
│  └── images/
└── assets/
     └── icons/
```

### Routes
- `/` - Home (currently shows same as /pfps)
- `/pfps` - Profile pictures gallery
- `/banners` - Banners gallery
- `/explore` - Mixed feed (pfps + banners shuffled)
- `/liked` - User's liked images

## Important Technical Rules

### Storage
- **NEVER use localStorage or sessionStorage** in artifacts/React components
- Use in-memory state with useState/variables for React
- Use regular JavaScript variables for vanilla JS
- LocalStorage is OK in main script.js for persistence

### Icons
- All UI icons must be inline SVG (defined in index.html `<defs>`)
- No external image loading for UI icons
- Use `<use href="#icon-name">` to reference icons

### Images
- Image paths: `/pfps/images/` and `/banners/images/`
- Supported formats: .png, .jpg, .jpeg, .gif
- Tags are arrays in images_list.js files

### Code Style
- Prefer complete, functional code blocks
- Mark significant changes with comments: `// === ADDED: description ===`
- Test logic mentally before suggesting
- Preserve existing functionality when adding features
- Use semantic variable names

## Current Features
- Tag filtering (hardcoded: black, white, dark, pink, GIF)
- Like/unlike images (localStorage persistence)
- Modal image view with enlarge
- Infinite scroll with batch loading
- Responsive columns (3-7 based on viewport)
- GIF badge indicator
- Filter dropdown in search bar
- Client-side routing (SPA)

## Development Priorities
1. Maintain existing functionality
2. Write clean, readable code
3. Follow established patterns
4. Test before committing
5. Document significant changes
