// :
// Lists contain filenames only. Paths are built here.
// This file is now a module and imports image lists directly.
import { router } from "./router.js";
import { pfpImages } from "./pfps/images_list.js";
import { bannerImages } from "./banners/images_list.js";
// Explorer prepared mixed array (module-scoped)
let exploreImages = [];

// Page type and images will be set dynamically by router
let pageType = "pfp";
let images = pfpImages;

// Function called by router to update page type
function updatePageType(type) {
  pageType = type;
  images = type === "pfp" 
    ? pfpImages 
    : type === "banner" 
    ? bannerImages 
    : [];
}

// viewMode controls gallery source: "normal" | "liked"
let viewMode = "normal";

// activeTag controls tag filtering
let activeTag = "all";

/* =========================
   ELEMENTS
========================= */
const gallery = document.getElementById("gallery");

/* =========================
   MODAL
========================= */
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const modalClose = document.querySelector(".modal-close");
const modalOverlay = document.querySelector(".modal-overlay");
const modalLikeBtn = document.getElementById("modalLikeBtn");

let modalCurrent = null;

function openModal(src, filename, type) {
  modalCurrent = { filename, type };
  modalImg.src = src;
  modal.classList.remove("hidden");
  syncModalLike();
}

function closeModal() {
  modal.classList.add("hidden");
  modalImg.src = "";
  modalCurrent = null;
}

modalClose?.addEventListener("click", closeModal);
modalOverlay?.addEventListener("click", closeModal);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

/* =========================
   STATE
========================= */
const BATCH_SIZE_BASE = 12; // Rows per batch
let BATCH_SIZE = 12 * getColumnCount(); // Will be recalculated on column changes
let index = 0;

const loadedImages = new Set();
const likedImages = new Set(
  JSON.parse(localStorage.getItem("likedImages") || "[]")
);

let loadQueue = 0; // Track pending load requests

/* =========================
   COLUMNS (RESPONSIVE)
========================= */
const columns = [];
let COLUMN_COUNT = getColumnCount();

function getColumnCount() {
  if (window.innerWidth <= 500) return 3;
  if (window.innerWidth <= 900) return 4;
  if (window.innerWidth <= 1400) return 5;
  return 7;
}

function createColumns() {
  COLUMN_COUNT = getColumnCount();
  gallery.innerHTML = "";
  columns.length = 0;

  for (let i = 0; i < COLUMN_COUNT; i++) {
    const col = document.createElement("div");
    col.className = "column";
    gallery.appendChild(col);
    columns.push(col);
  }
  
  // Recalculate batch size when columns change
  BATCH_SIZE = BATCH_SIZE_BASE * COLUMN_COUNT;
}

createColumns();

/* =========================
   FILTER DROPDOWN
========================= */
const filterDrawerBtn = document.getElementById('filterDrawerBtn');
const filterDropdown = document.getElementById('filterDropdown');
const searchInput = document.getElementById('searchInput');

// Generate filter options in dropdown
function createFilterOptions() {
  const container = document.querySelector('.filter-dropdown-list');
  if (!container) return;

  // Hardcoded filter tags - these match common tags in images_list.js
  const filterTags = [
    { label: 'black', tag: 'black' },
    { label: 'white', tag: 'white' },
    { label: 'dark', tag: 'dark' },
    { label: 'pink', tag: 'pink' },
    { label: 'GIF', tag: 'gif' }  // Special case: filters by file extension
  ];

  filterTags.forEach(({ label, tag }) => {
    const btn = document.createElement('button');
    btn.className = 'filter-option';
    btn.dataset.tag = tag;
    btn.textContent = label;
    container.appendChild(btn);
  });
}

createFilterOptions();

// Toggle filter dropdown
filterDrawerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  filterDropdown.classList.toggle('hidden');
  
  // Swap icon between outline and filled
  const useEl = filterDrawerBtn.querySelector('.filter-drawer-icon use');
  if (filterDropdown.classList.contains('hidden')) {
    useEl?.setAttribute('href', '#icon-filterdrawer');
  } else {
    useEl?.setAttribute('href', '#icon-filterdrawer-filled');
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!filterDropdown.contains(e.target) && !filterDrawerBtn.contains(e.target)) {
    filterDropdown.classList.add('hidden');
    const useEl = filterDrawerBtn?.querySelector('.filter-drawer-icon use');
    useEl?.setAttribute('href', '#icon-filterdrawer');
  }
});

// Handle filter option clicks
filterDropdown?.addEventListener('click', (e) => {
  const filterOption = e.target.closest('.filter-option');
  if (filterOption) {
    const tag = filterOption.dataset.tag;
    filterByTag(tag);
    
    // Update active state
    document.querySelectorAll('.filter-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.tag === tag);
    });
    
    // Keep dropdown open - don't close it
  }
});

// Filter gallery by tag
function filterByTag(tag) {
  activeTag = tag;

  // Reset and reload gallery with filter
  index = 0;
  loadedImages.clear();
  createColumns();
  loadBatch();
}

/* =========================
   SEARCH FUNCTIONALITY
========================= */
const searchResultsPanel = document.getElementById('searchResultsPanel');
const searchTagsList = document.getElementById('searchTagsList');

// Track active search state
let activeSearch = {
  term: null,
  resultCount: 0,
  dividerInserted: false
};

// Check if a search term has any matching results
function hasSearchResults(query) {
  if (!query.trim()) return false;

  const lowerQuery = query.toLowerCase();
  
  // Get all images from pfp and banner
  const allImages = [
    ...pfpImages.map(img => ({ ...img, type: 'pfp' })),
    ...bannerImages.map(img => ({ ...img, type: 'banner' }))
  ];

  // Check if ANY image matches the search query
  return allImages.some(img => {
    const filenameMatch = img.file.toLowerCase().includes(lowerQuery);
    const tagsMatch = img.tags && img.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    return filenameMatch || tagsMatch;
  });
}

// Show suggested tags as user types
function showTagSuggestions(query) {
  if (!query.trim()) {
    searchResultsPanel.classList.add('hidden');
    // Clear search divider when input is emptied
    clearSearchDivider();
    return;
  }

  const lowerQuery = query.toLowerCase();
  
  // Get all images from pfp and banner
  const allImages = [
    ...pfpImages.map(img => ({ ...img, type: 'pfp' })),
    ...bannerImages.map(img => ({ ...img, type: 'banner' }))
  ];

  // Count tag occurrences across ALL images
  const allTagCounts = new Map();
  allImages.forEach(img => {
    if (img.tags) {
      img.tags.forEach(tag => {
        allTagCounts.set(tag, (allTagCounts.get(tag) || 0) + 1);
      });
    }
  });

  // Find matching tags
  const tagMatches = new Map();
  allImages.forEach(img => {
    if (img.tags) {
      img.tags.forEach(tag => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          tagMatches.set(tag, (tagMatches.get(tag) || 0) + 1);
        }
      });
    }
  });

  // Filter and sort tags: only show tags with 10+ occurrences, sorted by count (descending)
  const filteredTags = Array.from(tagMatches.entries())
    .filter(([tag, matchCount]) => allTagCounts.get(tag) >= 10) // Only tags in 10+ images
    .sort((a, b) => allTagCounts.get(b[0]) - allTagCounts.get(a[0])) // Sort by total count descending
    .slice(0, 15); // Limit to top 15

  // Render tags section
  searchTagsList.innerHTML = '';
  if (filteredTags.length > 0) {
    filteredTags.forEach(([tag, matchCount]) => {
      const totalCount = allTagCounts.get(tag);
      const item = document.createElement('button');
      item.className = 'search-tag-item';
      item.textContent = `${tag} (${totalCount})`;
      item.addEventListener('click', () => {
        // Validate before executing search
        if (hasSearchResults(tag)) {
          searchInput.value = tag;
          executeSearch(tag);
          searchResultsPanel.classList.add('hidden');
        } else {
          // Show "No results" message if validation fails
          searchTagsList.innerHTML = `<p style="color: #ff6b6b; font-size: 13px;">No results found for "${tag}"</p>`;
        }
      });
      searchTagsList.appendChild(item);
    });
  } else {
    searchTagsList.innerHTML = '<p style="color: #999; font-size: 13px;">No matching tags</p>';
  }

  searchResultsPanel.classList.remove('hidden');
}

// Clear search divider and reset search state
function clearSearchDivider() {
  // Clear active search state and search source so gallery returns to normal
  activeSearch = {
    term: null,
    resultCount: 0,
    dividerInserted: false,
    searchSource: null
  };

  // Reset gallery to normal state
  index = 0;
  loadedImages.clear();
  createColumns();
  loadBatch();
}

// Execute search - filter gallery by search term
function executeSearch(query) {
  const lowerQuery = query.toLowerCase();
  
  // Get all images from pfp and banner
  const allImages = [
    ...pfpImages.map(img => ({ ...img, type: 'pfp' })),
    ...bannerImages.map(img => ({ ...img, type: 'banner' }))
  ];

  // Filter images that match the search query (filename OR tags)
  const matchingImages = allImages.filter(img => {
    const filenameMatch = img.file.toLowerCase().includes(lowerQuery);
    const tagsMatch = img.tags && img.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    return filenameMatch || tagsMatch;
  });

  // Track active search and set search-only source
  activeSearch = {
    term: query,
    resultCount: matchingImages.length,
    dividerInserted: false,
    searchSource: matchingImages
  };

  // Update gallery to show only matching results
  activeTag = 'all'; // Reset active tag
  index = 0;
  loadedImages.clear();
  createColumns();
  loadBatch();
}

// Search input event listener - show tag suggestions
searchInput?.addEventListener('input', (e) => {
  showTagSuggestions(e.target.value);
});

// Handle search input focus - show panel if there's text
searchInput?.addEventListener('focus', () => {
  if (searchInput.value.trim()) {
    showTagSuggestions(searchInput.value);
  }
});

// Handle Enter key - execute search with validation
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query && hasSearchResults(query)) {
      executeSearch(query);
      searchResultsPanel.classList.add('hidden');
      searchInput.blur();
    } else if (query) {
      // Show "No results" message if validation fails
      searchTagsList.innerHTML = `<p style="color: #ff6b6b; font-size: 13px;">No results found for "${query}"</p>`;
      searchResultsPanel.classList.remove('hidden');
    }
  }
});

// Handle click outside search panel and input
document.addEventListener('click', (e) => {
  const isSearchRelated = searchInput.contains(e.target) || searchResultsPanel.contains(e.target);
  if (!isSearchRelated) {
    searchResultsPanel.classList.add('hidden');
  }
});

// Handle Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchResultsPanel.classList.add('hidden');
    searchInput?.blur();
  }
});

/* =========================
   SHUFFLE + MIXED FEED
========================= */
// Fisher–Yates shuffle: shuffles in place and returns the array
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
function getImageSource() {
  // If a search is active, return the search-only source so infinite
  // scroll loads only matching images.
  if (activeSearch && activeSearch.term && Array.isArray(activeSearch.searchSource)) {
    return activeSearch.searchSource;
  }

  let source;

  // 1. Liked = always global
  if (viewMode === "liked") {
    source = [...likedImages].map(key => {
      const [type, file] = key.split("/");
      return { type, file };
    });
  }
  // 2. Explore = mixed (groundwork for tags later)
  else if (viewMode === "explore") {
    // If an explore-specific, precomputed source exists (created below), use it.
    if (Array.isArray(exploreImages) && exploreImages.length) {
      source = exploreImages;
    } else {
      // Fallback: combine without `src` if no precomputed array exists
      source = [
        ...((pfpImages || []).map(img => ({
          type: "pfp",
          file: img.file,
          tags: img.tags
        })) || []),
        ...((bannerImages || []).map(img => ({
          type: "banner",
          file: img.file,
          tags: img.tags
        })) || [])
      ];
    }
  }
  // 3. Default = current page only
  else {
    source = images.map(img => ({
      type: pageType,
      file: img.file,
      tags: img.tags
    }));
  }

  // Apply tag filter
  if (activeTag !== "all") {
    if (activeTag === "gif") {
      // Special case: Filter by file extension for GIFs
      source = source.filter(img =>
        img.file && img.file.toLowerCase().endsWith('.gif')
      );
    } else {
      // Regular tag filtering: check if any tag includes the filter
      source = source.filter(img =>
        img.tags && img.tags.some(tag =>
          tag.toLowerCase().includes(activeTag.toLowerCase())
        )
      );
    }
  }

  return source;
}

/* =========================
   CREATE CARD
========================= */
function createCard(filename, type, isHighPriority = false, overrideSrc) {
  const card = document.createElement("div");
  card.className = `card ${type}`;
  const key = `${type}/${filename}`;
  card.dataset.key = key;

  const img = document.createElement("img");
  img.dataset.key = key;
  // Use provided `overrideSrc` (explore precomputed `src`) if available,
  // otherwise fall back to the existing path construction.
  const src = overrideSrc || `/${type}s/images/${filename}`;

  img.src = src;
  // Keep the actual resolved src on dataset so other handlers can prefer it
  img.dataset.src = src;
  img.alt = filename;
  img.loading = "lazy";
  img.decoding = "async";

  // Prioritize images likely to be in the first viewport
  if (isHighPriority) img.fetchPriority = "high";

  img.addEventListener("load", () => {
    img.classList.add("loaded");
    card.classList.add("visible");
  });
  img.addEventListener("error", () => card.remove());

  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.innerHTML = `
    <svg class="card-icon" width="20" height="20" aria-hidden="true">
      <use href="#icon-heart-outline"></use>
    </svg>
  `;

  if (likedImages.has(key)) {
    likeBtn.classList.add("liked");
    const useElement = likeBtn.querySelector(".card-icon use");
    if (useElement) useElement.setAttribute('href', '#icon-heart-filled');
  }

  const enlargeBtn = document.createElement("button");
  enlargeBtn.className = "enlarge-btn";
  enlargeBtn.innerHTML = `
    <svg class="card-icon" width="20" height="20" aria-hidden="true">
      <use href="#icon-expand"></use>
    </svg>
  `;

  // === GIF badge (appear on hover) ===
  const isGif = filename.toLowerCase().endsWith('.gif');
  let gifBadge = null;
  if (isGif) {
    gifBadge = document.createElement('div');
    gifBadge.className = 'gif-badge';
    gifBadge.innerHTML = `
      <svg class="gif-icon" width="20" height="20" aria-hidden="true">
        <use href="#icon-gif-badge"></use>
      </svg>
    `;
  }

  // Append elements; badge should be above image but below buttons via z-index
  if (gifBadge) card.append(img, enlargeBtn, likeBtn, gifBadge);
  else card.append(img, enlargeBtn, likeBtn);
  return card;
}

/* =========================
   LIKE LOGIC
========================= */
// Event delegation: handle like/enlarge clicks and double-tap like on images
const _lastTapMap = new Map();
gallery.addEventListener("pointerup", e => {
  const img = e.target.closest("img");
  if (!img || !gallery.contains(img)) return;
  const key = img.dataset.key;
  if (!key) return;
  const now = Date.now();
  const last = _lastTapMap.get(key) || 0;
  if (now - last < 300) {
    const [type, filename] = key.split("/");
    toggleLike(filename, type);
    const card = img.closest(".card");
    const likeBtn = card?.querySelector(".like-btn");
    likeBtn?.classList.toggle("liked");
  }
  _lastTapMap.set(key, now);
});

gallery.addEventListener("click", e => {
  const likeBtn = e.target.closest(".like-btn");
  if (likeBtn && gallery.contains(likeBtn)) {
    e.stopPropagation();
    const card = likeBtn.closest(".card");
    const key = card?.dataset.key;
    if (!key) return;
    const [type, filename] = key.split("/");
    toggleLike(filename, type);
    likeBtn.classList.toggle("liked");
    return;
  }

  const enlargeBtn = e.target.closest(".enlarge-btn");
  if (enlargeBtn && gallery.contains(enlargeBtn)) {
    e.stopPropagation();
    const card = enlargeBtn.closest(".card");
    const key = card?.dataset.key;
    if (!key) return;
    const [type, filename] = key.split("/");
    const imgEl = card.querySelector("img");
    const src = imgEl?.dataset?.src || imgEl?.src || `/${type}s/images/${filename}`;
    openModal(src, filename, type);
    return;
  }
});



function toggleLike(filename, type) {
  const key = `${type}/${filename}`;

let selector;
if (window.CSS && CSS.escape) selector = `.card[data-key="${CSS.escape(key)}"]`;
else selector = `.card[data-key=\"${key.replace(/\"/g, '\\\"')}\"]`;
const card = document.querySelector(selector);

const likeBtn = card?.querySelector(".like-btn");
const useElement = likeBtn?.querySelector('.card-icon use');

if (likedImages.has(key)) {
  likedImages.delete(key);

  if (useElement) {
    useElement.setAttribute('href', '#icon-heart-outline');
  }
} else {
  likedImages.add(key);

  if (useElement) {
    useElement.setAttribute('href', '#icon-heart-filled');
  }
}
  localStorage.setItem("likedImages", JSON.stringify([...likedImages]));
  syncModalLike();
}

function syncModalLike() {
  if (!modalCurrent || !modalLikeBtn) return;

  const key = `${modalCurrent.type}/${modalCurrent.filename}`;
  const isLiked = likedImages.has(key);
  modalLikeBtn.classList.toggle("liked", isLiked);

  // Swap modal icon to match liked state
  const useEl = modalLikeBtn.querySelector('use');
  if (useEl) useEl.setAttribute('href', isLiked ? '#icon-heart-filled' : '#icon-heart-outline');
}

modalLikeBtn?.addEventListener("click", () => {
  if (!modalCurrent) return;
  toggleLike(modalCurrent.filename, modalCurrent.type);
});

/* =========================
   LOAD BATCH
========================= */
function loadBatch() {
  const source = getImageSource();
  const batch = source.slice(index, index + BATCH_SIZE);
  const fragments = columns.map(() => document.createDocumentFragment());

  batch.forEach((item, i) => {
    const key = `${item.type}/${item.file}`;
    if (loadedImages.has(key)) return;

    loadedImages.add(key);
    const isHighPriority = (index + i) < 6;
    // Pass item.src when available so explore items can provide full paths
    const card = createCard(item.file, item.type, isHighPriority, item.src);

    const columnIndex = (index + i) % COLUMN_COUNT;
    const rowIndex = Math.floor((index + i) / COLUMN_COUNT);

    // cap stagger after N rows
    const MAX_STAGGER_ROWS = 6;
    const delay = Math.min(rowIndex, 5) * 35;

    card.style.setProperty("--enter-delay", `${delay}ms`);

    fragments[columnIndex].appendChild(card);
  });

  fragments.forEach((frag, i) => {
    columns[i].appendChild(frag);
  });

  index += batch.length;

  // No divider insertion — search mode returns only matching images.
}

/* =========================
   INFINITE SCROLL
========================= */
const sentinel = document.createElement("div");
gallery.after(sentinel);

const observer = new IntersectionObserver(
  ([e]) => {
    if (!e.isIntersecting) return;
    
    // Don't queue more than 2 loads ahead
    if (loadQueue > 2) return;
    
    loadQueue++;
    
    requestAnimationFrame(() => {
      loadBatch();
      
      requestAnimationFrame(() => {
        loadQueue--;
        
        // If still intersecting and more to load, chain another batch
        if (e.isIntersecting && loadQueue === 0 && index < getImageSource().length) {
          loadQueue++;
          setTimeout(() => {
            loadBatch();
            loadQueue--;
          }, 50);
        }
      });
    });
  },
  { rootMargin: "1500px" } // Trigger 1500px before reaching sentinel
);
observer.observe(sentinel);

// Function called by router to update view mode
function updateViewMode(route) {
  if (route === "/liked") {
    viewMode = "liked";
  } else if (route === "/explore") {
    viewMode = "explore";
  } else {
    viewMode = "normal";
  }
}

/* =========================
   PREPARE EXPLORE ARRAY
========================= */
function prepareExploreArray() {
  try {
    const pfpList = Array.isArray(pfpImages)
      ? pfpImages.map(img => ({
          type: "pfp",
          file: img.file,
          tags: img.tags,
          src: `/pfps/images/${img.file}`
        }))
      : [];

    const bannerList = Array.isArray(bannerImages)
      ? bannerImages.map(img => ({
          type: "banner",
          file: img.file,
          tags: img.tags,
          src: `/banners/images/${img.file}`
        }))
      : [];

    const combined = [...pfpList, ...bannerList];
    shuffleArray(combined);
    exploreImages = combined;
  } catch (err) {
    console.error("Failed to prepare explore mixed feed", err);
  }
}

/* =========================
   GALLERY RESET
========================= */
function resetGallery() {
  // Clear current state
  index = 0;
  loadedImages.clear();
  
  // Reset filter dropdown buttons
  document.querySelectorAll('.filter-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === activeTag);
  });
  
  // Recreate columns (handles responsive sizing)
  createColumns();
  
  // Load initial batches
  const sourceImages = getImageSource();
  if (sourceImages.length > 0) {
    loadBatch();
    
    // Preload second batch for smooth scrolling
    setTimeout(() => {
      if (index < getImageSource().length) {
        loadBatch();
      }
    }, 100);
  }
}

/* =========================
   RESIZE HANDLING
========================= */
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const newCount = getColumnCount();
    if (newCount !== COLUMN_COUNT) {
      index = 0;
      loadedImages.clear();
      createColumns(); // Recalculates BATCH_SIZE automatically
      
      // Load two batches for better initial view after resize
      loadBatch();
      setTimeout(() => {
        if (index < getImageSource().length) {
          loadBatch();
        }
      }, 100);
    }
  }, 150);
});

/* =========================
   ROUTER SETUP & INITIALIZATION
========================= */

// Define route handlers

// Home route (front page)
router.addRoute('/', () => {
  activeTag = "all";
  updatePageType('pfp'); // Currently shows same content as pfps
  updateViewMode('/'); // Normal mode
  resetGallery();
});

// PFPs route (dedicated pfp gallery)
router.addRoute('/pfps', () => {
  activeTag = "all";
  updatePageType('pfp');
  updateViewMode('/pfps');
  resetGallery();
});

// Banners route
router.addRoute('/banners', () => {
  activeTag = "all";
  updatePageType('banner');
  updateViewMode('/banners');
  resetGallery();
});

// Explore route
router.addRoute('/explore', () => {
  activeTag = "all";
  updatePageType('pfp'); // Doesn't matter for explore (uses both)
  updateViewMode('/explore');
  prepareExploreArray(); // Prepare mixed array before loading
  resetGallery();
});

// Liked route
router.addRoute('/liked', () => {
  activeTag = "all";
  updatePageType('pfp'); // Doesn't matter for liked (uses stored keys)
  updateViewMode('/liked');
  resetGallery();
});

// Initialize router - it will automatically load the current route
router.init();