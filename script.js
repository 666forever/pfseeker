// :
// Lists contain filenames only. Paths are built here.
// This file is now a module and imports image lists directly.
import { router } from "./router.js";
import { pfpImages } from "./pfps/images_list.js";
import { bannerImages } from "./banners/images_list.js";

// Prepared shuffled arrays (module-scoped)
let exploreImages = [];
let shuffledPfpImages = [];
let shuffledBannerImages = [];

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
const searchRow = document.querySelector('.search-row');
const searchClearBtn = document.getElementById('searchClearBtn');

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
  // If search panel is open, close it first to prevent overlap
  if (searchResultsPanel && !searchResultsPanel.classList.contains('hidden')) {
    searchResultsPanel.classList.add('hidden');
    searchInput?.blur();
    if (searchClearBtn) searchClearBtn.classList.add('hidden');
  }

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
   SORT DROPDOWN & DAILY SHUFFLE
========================= */

const sortDrawerBtn = document.getElementById('sortDrawerBtn');
const sortDropdown = document.getElementById('sortDropdown');

// Current sort mode
let currentSortMode = 'daily'; // Default to daily shuffle

// Toggle sort dropdown
sortDrawerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  
  // Close search panel and filter dropdown if open
  if (searchResultsPanel && !searchResultsPanel.classList.contains('hidden')) {
    searchResultsPanel.classList.add('hidden');
    searchInput?.blur();
    if (searchClearBtn) searchClearBtn.classList.add('hidden');
  }
  if (filterDropdown && !filterDropdown.classList.contains('hidden')) {
    filterDropdown.classList.add('hidden');
    const useEl = filterDrawerBtn?.querySelector('.filter-drawer-icon use');
    useEl?.setAttribute('href', '#icon-filterdrawer');
  }

  sortDropdown.classList.toggle('hidden');
  
  // Swap icon between outline and filled
  const useEl = sortDrawerBtn.querySelector('.sort-drawer-icon use');
  if (sortDropdown.classList.contains('hidden')) {
    useEl?.setAttribute('href', '#icon-sort');
  } else {
    useEl?.setAttribute('href', '#icon-sort-filled');
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (sortDropdown && !sortDropdown.contains(e.target) && !sortDrawerBtn?.contains(e.target)) {
    sortDropdown.classList.add('hidden');
    const useEl = sortDrawerBtn?.querySelector('.sort-drawer-icon use');
    useEl?.setAttribute('href', '#icon-sort');
  }
});

// Handle sort option clicks
sortDropdown?.addEventListener('click', (e) => {
  const sortOption = e.target.closest('.filter-option');
  if (sortOption) {
    const sortMode = sortOption.dataset.sort;
    currentSortMode = sortMode;
    
    // Update active state
    document.querySelectorAll('#sortDropdown .filter-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.sort === sortMode);
    });
    
    // Store preference
    localStorage.setItem('sortMode', sortMode);
    
    // Reset and reload gallery with new sort
    index = 0;
    loadedImages.clear();
    createColumns();
    loadBatch();
    
    // Close dropdown
    sortDropdown.classList.add('hidden');
    const useEl = sortDrawerBtn?.querySelector('.sort-drawer-icon use');
    useEl?.setAttribute('href', '#icon-sort');
  }
});

/* =========================
   DAILY SHUFFLE LOGIC
========================= */

// Get today's date as string (YYYY-MM-DD)
function getTodayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Apply daily shuffle to an array
function applyDailyShuffle(arr, storageKey) {
  if (currentSortMode !== 'daily') {
    return arr; // Return original order if not in daily shuffle mode
  }
  
  const today = getTodayString();
  const lastShuffleDate = localStorage.getItem(`${storageKey}_date`);
  
  // If we've already shuffled today, use the stored order
  if (lastShuffleDate === today) {
    const stored = localStorage.getItem(`${storageKey}_order`);
    if (stored) {
      try {
        const order = JSON.parse(stored);
        // Reorder array based on stored indices
        return order.map(idx => arr[idx]).filter(Boolean);
      } catch (e) {
        console.error('Failed to parse shuffle order', e);
      }
    }
  }
  
  // New day or first time - create new shuffle
  const indices = arr.map((_, i) => i);
  shuffleArray(indices);
  
  // Store the shuffle order and date
  localStorage.setItem(`${storageKey}_order`, JSON.stringify(indices));
  localStorage.setItem(`${storageKey}_date`, today);
  
  // Return shuffled array
  return indices.map(idx => arr[idx]);
}

// Override getImageSource to apply daily shuffle
const originalGetImageSource = getImageSource;
window.getImageSource = function() {
  let source = originalGetImageSource();
  
  // Only apply daily shuffle on /pfps and /banners pages in normal mode
  if (currentSortMode === 'daily' && viewMode === 'normal') {
    if (pageType === 'pfp') {
      source = applyDailyShuffle(source, 'pfp_shuffle');
    } else if (pageType === 'banner') {
      source = applyDailyShuffle(source, 'banner_shuffle');
    }
  }
  
  return source;
};

/* =========================
   SHOW/HIDE SORT BUTTON BASED ON PAGE
========================= */

function updateSortButtonVisibility() {
  if (!sortDrawerBtn) return;
  
  const currentRoute = router.getCurrentRoute();
  
  // Show sort button only on /pfps and /banners
  if (currentRoute === '/pfps' || currentRoute === '/banners') {
    sortDrawerBtn.classList.remove('hidden');
  } else {
    sortDrawerBtn.classList.add('hidden');
    // Also close dropdown if it's open
    sortDropdown?.classList.add('hidden');
  }
}

// Load saved sort mode
const savedSortMode = localStorage.getItem('sortMode');
if (savedSortMode) {
  currentSortMode = savedSortMode;
  // Update active state in dropdown
  document.querySelectorAll('#sortDropdown .filter-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.sort === savedSortMode);
  });
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
  // Show panel even when query is empty (clicking search bar should open suggestions)
  const lowerQuery = (query || '').toLowerCase();

  // Aggregate all tags from both pfp and banner images
  const allImages = [
    ...pfpImages.map(img => ({ ...img, type: 'pfp' })),
    ...bannerImages.map(img => ({ ...img, type: 'banner' }))
  ];

  // Count occurrences of each tag
  const tagCounts = new Map();
  allImages.forEach(img => {
    if (!img.tags) return;
    img.tags.forEach(tag => {
      if (typeof tag !== 'string') return;
      
      // Remove surrounding quotes (single or double) and trim
      const cleanTag = tag.replace(/^['"]|['"]$/g, '').trim();
      
      // Skip invalid tags: empty, too short, or no Latin alphabet letters
      if (!cleanTag || cleanTag.length < 2) return;
      // Must START with a letter (no leading punctuation/special chars)
      if (!/^[a-zA-Z]/.test(cleanTag)) return;
      // Must be at least 50% letters (excludes tags like "??expression")
      const letterCount = (cleanTag.match(/[a-zA-Z]/g) || []).length;
      const letterRatio = letterCount / cleanTag.length;
      if (letterRatio < 0.5) return;
      
      // If there's a search query, ensure the clean tag includes it
      if (!lowerQuery || cleanTag.toLowerCase().includes(lowerQuery)) {
        tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
      }
    });
  });

  // Convert to array of [tag, count], sort by count DESC, then take top 11
  const filteredTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, 11)
    .map(([tag]) => tag); // Extract just the tag names

  // Render tags section without counts (clean list)
  searchTagsList.innerHTML = '';
  if (filteredTags.length > 0) {
    filteredTags.forEach(tag => {
      const cleanTag = (typeof tag === 'string') ? tag.replace(/^['"]|['"]$/g, '').trim() : String(tag);
      const item = document.createElement('button');
      item.className = 'search-tag-item';

      // Inline SVG icon (use <use href="#icon-search">)
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'search-tag-icon');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('viewBox', '0 0 24 24');
      const use = document.createElementNS(svgNS, 'use');
      use.setAttribute('href', '#icon-search');
      svg.appendChild(use);

      const span = document.createElement('span');
      span.className = 'search-tag-text';
      span.textContent = cleanTag;

      item.appendChild(svg);
      item.appendChild(span);

      item.addEventListener('click', () => {
        if (hasSearchResults(cleanTag)) {
          searchInput.value = cleanTag;
          // show clear button when tag selected
          searchClearBtn?.classList.remove('hidden');
          executeSearch(cleanTag);
          searchResultsPanel.classList.add('hidden');
        } else {
          searchTagsList.innerHTML = `<p style="color: #ff6b6b; font-size: 13px;">No results found for "${cleanTag}"</p>`;
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
  const val = e.target.value || '';
  showTagSuggestions(val);

  // Toggle clear button visibility
  if (searchClearBtn) {
    if (val.trim()) searchClearBtn.classList.remove('hidden');
    else searchClearBtn.classList.add('hidden');
  }
});

// Handle search input focus - show panel if there's text
searchInput?.addEventListener('focus', () => {
  // Always show suggestions panel on focus (empty or not)
  showTagSuggestions(searchInput.value || '');
});

// Handle Enter key - execute search with validation
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query && hasSearchResults(query)) {
      executeSearch(query);
      searchResultsPanel.classList.add('hidden');
      searchClearBtn?.classList.remove('hidden');
      searchInput.blur();
    } else if (query) {
      // Show "No results" message if validation fails
      searchTagsList.innerHTML = `<p style="color: #ff6b6b; font-size: 13px;">No results found for "${query}"</p>`;
      searchResultsPanel.classList.remove('hidden');
    }
  }
});

// Clear button behavior: clear input and close panel
searchClearBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (searchInput) searchInput.value = '';
  if (searchClearBtn) searchClearBtn.classList.add('hidden');
  if (searchResultsPanel) searchResultsPanel.classList.add('hidden');
  clearSearchDivider();
  searchInput?.blur();
});

// Handle click outside search-area: close panel when clicking outside the entire search row
document.addEventListener('click', (e) => {
  const isSearchRelated = searchRow && searchRow.contains(e.target);
  if (!isSearchRelated) {
    searchResultsPanel.classList.add('hidden');
  }
});

// Handle Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchResultsPanel.classList.add('hidden');
    searchInput?.blur();
    if (searchClearBtn) searchClearBtn.classList.add('hidden');
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

// Simple hash function to get consistent size for each filename
function hashFilename(filename) {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = ((hash << 5) - hash) + filename.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Get size class for a card based on filename (consistent sizing)
function getCardSize(filename, type) {
  // Apply size variations to:
  // - PFPs in /pfps
  // - Banners in /banners  
  // - BOTH in /explore (for comparison)
  const shouldApplyVariations = 
    (type === 'pfp' && viewMode === 'normal' && pageType === 'pfp') ||
    (type === 'banner' && viewMode === 'normal' && pageType === 'banner') ||
    (viewMode === 'explore'); // Enable for explore
  
  if (!shouldApplyVariations) {
    return 'size-medium'; // Default for liked
  }
  
  const hash = hashFilename(filename);
  const sizeIndex = hash % 3; // 0, 1, or 2
  
  // Equal distribution: 33% each
  if (sizeIndex === 0) return 'size-small';
  if (sizeIndex === 1) return 'size-medium';
  return 'size-large';
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
    // Use shuffled arrays if available for /pfps and /banners
    if (pageType === "pfp" && shuffledPfpImages.length > 0) {
      source = shuffledPfpImages;
    } else if (pageType === "banner" && shuffledBannerImages.length > 0) {
      source = shuffledBannerImages;
    } else {
      // Fallback to original arrays
      source = images.map(img => ({
        type: pageType,
        file: img.file,
        tags: img.tags
      }));
    }
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
  
  // Get size class for this card
  const sizeClass = getCardSize(filename, type);
  
  card.className = `card ${type} ${sizeClass}`;
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
// Event delegation: handle like/enlarge clicks
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
    
    // Save current route before navigating
    previousRoute = router.getCurrentRoute();
    
    // Navigate to image detail page
    router.navigate(`/${type}s/${filename}`);
    return;
  }
  
  // === ADDED: Click image to open detail view ===
  const img = e.target.closest("img");
  if (img && gallery.contains(img)) {
    e.stopPropagation();
    const key = img.dataset.key;
    if (!key) return;
    const [type, filename] = key.split("/");
    
    // Save current route before navigating
    previousRoute = router.getCurrentRoute();
    
    // Navigate to image detail page
    router.navigate(`/${type}s/${filename}`);
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
   IMAGE DETAIL PAGE
========================= */
const imageDetailPage = document.getElementById('imageDetailPage');
const detailImage = document.getElementById('detailImage');
const detailBackBtn = document.getElementById('detailBackBtn');

// Store scroll position and previous route before navigating to detail page
let savedScrollPosition = 0;
let previousRoute = '/';

// Show image detail page
function showImageDetail(filename, type) {
  // Save current scroll position
  savedScrollPosition = window.scrollY;
  
  // Build image source path
  const src = `/${type}s/images/${filename}`;
  
  // Show detail page
  detailImage.src = src;
  detailImage.alt = filename;
  imageDetailPage.classList.remove('hidden');
  gallery.classList.add('hidden');
  
  // Hide search elements
  const searchRow = document.querySelector('.search-row');
  if (searchRow) searchRow.style.display = 'none';
  
  // Prevent scrolling the gallery underneath
  document.body.style.overflow = 'hidden';
}

// Hide image detail page and return to gallery
function hideImageDetail() {
  imageDetailPage.classList.add('hidden');
  gallery.classList.remove('hidden');
  
  // Show search elements
  const searchRow = document.querySelector('.search-row');
  if (searchRow) searchRow.style.display = '';
  
  // Re-enable scrolling
  document.body.style.overflow = '';
  
  // Restore scroll position
  window.scrollTo(0, savedScrollPosition);
}

// Back button click handler
detailBackBtn?.addEventListener('click', () => {
  // Navigate back to the saved previous route
  router.navigate(previousRoute);
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
   PREPARE PFP ARRAY (SHUFFLED)
========================= */
function preparePfpArray() {
  try {
    const pfpList = Array.isArray(pfpImages)
      ? pfpImages.map(img => ({
          type: "pfp",
          file: img.file,
          tags: img.tags
        }))
      : [];

    shuffleArray(pfpList);
    shuffledPfpImages = pfpList;
  } catch (err) {
    console.error("Failed to prepare pfp array", err);
  }
}

/* =========================
   PREPARE BANNER ARRAY (SHUFFLED)
========================= */
function prepareBannerArray() {
  try {
    const bannerList = Array.isArray(bannerImages)
      ? bannerImages.map(img => ({
          type: "banner",
          file: img.file,
          tags: img.tags
        }))
      : [];

    shuffleArray(bannerList);
    shuffledBannerImages = bannerList;
  } catch (err) {
    console.error("Failed to prepare banner array", err);
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
  updatePageType('pfp'); // Doesn't matter for explore (uses both)
  updateViewMode('/explore'); // Use explore view mode
  
  // Only shuffle once per session - don't reshuffle if already prepared
  if (!exploreImages || exploreImages.length === 0) {
    prepareExploreArray();
  }
  
  hideImageDetail(); // Hide detail page if showing
  updateSortButtonVisibility();
  resetGallery();
});

// PFPs route (dedicated pfp gallery)
router.addRoute('/pfps', () => {
  activeTag = "all";
  updatePageType('pfp');
  updateViewMode('/pfps');
  
  // Only shuffle once per session - don't reshuffle if already prepared
  if (!shuffledPfpImages || shuffledPfpImages.length === 0) {
    preparePfpArray();
  }
  
  hideImageDetail(); // Hide detail page if showing
  updateSortButtonVisibility();
  resetGallery();
});

// Banners route
router.addRoute('/banners', () => {
  activeTag = "all";
  updatePageType('banner');
  updateViewMode('/banners');
  
  // Only shuffle once per session - don't reshuffle if already prepared
  if (!shuffledBannerImages || shuffledBannerImages.length === 0) {
    prepareBannerArray();
  }
  
  hideImageDetail(); // Hide detail page if showing
  updateSortButtonVisibility();
  resetGallery();
});

// Explore route
router.addRoute('/explore', () => {
  activeTag = "all";
  updatePageType('pfp'); // Doesn't matter for explore (uses both)
  updateViewMode('/explore');
  
  // Only shuffle once per session - don't reshuffle if already prepared
  if (!exploreImages || exploreImages.length === 0) {
    prepareExploreArray();
  }
  
  // Check if we're returning from detail page BEFORE hiding it
  const comingFromDetailPage = imageDetailPage && !imageDetailPage.classList.contains('hidden');
  
  hideImageDetail(); // Hide detail page if showing
  updateSortButtonVisibility();
  
  // Only reset gallery if NOT coming from detail page
  if (!comingFromDetailPage) {
    resetGallery();
  }
});

// Liked route
router.addRoute('/liked', () => {
  activeTag = "all";
  updatePageType('pfp'); // Doesn't matter for liked (uses stored keys)
  updateViewMode('/liked');
  hideImageDetail(); // Hide detail page if showing
  updateSortButtonVisibility();
  resetGallery();
});

// Image detail routes
router.addRoute('/pfps/:filename', (params) => {
  showImageDetail(params.filename, 'pfp');
});

router.addRoute('/banners/:filename', (params) => {
  showImageDetail(params.filename, 'banner');
});

// Initialize router - it will automatically load the current route
router.init();