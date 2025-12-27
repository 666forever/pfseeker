// :
// images_list.js must load before this file.
// Lists contain filenames only. Paths are built here.



const pageType = location.pathname.includes("/banners")
  ? "banner"
  : "pfp";

  const images =
  pageType === "pfp"
    ? window.pfpImages
    : pageType === "banner"
    ? window.bannerImages
    : [];

// viewMode controls gallery source: "normal" | "liked"
let viewMode = "normal";

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
  // 1. Liked = always global
  if (viewMode === "liked") {
    return [...likedImages].map(key => {
      const [type, file] = key.split("/");
      return { type, file };
    });
  }

  // 2. Explore = mixed (groundwork for tags later)
  if (viewMode === "explore") {
    // If an explore-specific, precomputed source exists (created below), use it.
    if (Array.isArray(window.exploreImages) && window.exploreImages.length) {
      return window.exploreImages;
    }

    // Fallback: combine without `src` if no precomputed array exists
    return [
      ...((window.pfpImages || []).map(img => ({
        type: "pfp",
        file: img.file,
        tags: img.tags
      })) || []),
      ...((window.bannerImages || []).map(img => ({
        type: "banner",
        file: img.file,
        tags: img.tags
      })) || [])
    ];
  }

  // 3. Default = current page only
  return images.map(img => ({
    type: pageType,
    file: img.file,
    tags: img.tags
  }));
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
    <img
      src="https://666forever.github.io/pfseeker-assets/icons/svg/heart-alt.svg"
      alt=""
      class="card-icon"
    />
  `;

  if (likedImages.has(key)) {
    likeBtn.classList.add("liked");
    const icon = likeBtn.querySelector(".card-icon");
    if (icon) icon.src = "https://666forever.github.io/pfseeker-assets/icons/svg/heart-filled.svg";
  }

  const enlargeBtn = document.createElement("button");
  enlargeBtn.className = "enlarge-btn";
  enlargeBtn.innerHTML = `
    <img
      src="https://666forever.github.io/pfseeker-assets/icons/svg/expand.svg"
      alt=""
      class="card-icon"
    />
  `;

  card.append(img, enlargeBtn, likeBtn);
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
const icon = likeBtn?.querySelector(".card-icon");

if (likedImages.has(key)) {
  likedImages.delete(key);

  if (icon) {
    icon.src = "https://666forever.github.io/pfseeker-assets/icons/svg/heart-alt.svg";
  }
} else {
  likedImages.add(key);

  if (icon) {
    icon.src = "https://666forever.github.io/pfseeker-assets/icons/svg/heart-filled.svg";
  }
}
  localStorage.setItem("likedImages", JSON.stringify([...likedImages]));
  syncModalLike();
}

function syncModalLike() {
  if (!modalCurrent || !modalLikeBtn) return;

  const key = `${modalCurrent.type}/${modalCurrent.filename}`;
  modalLikeBtn.classList.toggle("liked", likedImages.has(key));
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

// If we're on the liked page, switch mode before loading
if (location.pathname.startsWith("/liked")) {
  viewMode = "liked";
}

// === ADDED: Activate explore mode on /explore/ page ===
if (location.pathname.startsWith("/explore")) {
  viewMode = "explore";
}
// Prepare a mixed, shuffled source for the explore page only.
if (location.pathname.startsWith("/explore")) {
  try {
    const pfpList = Array.isArray(window.pfpImages)
      ? window.pfpImages.map(img => ({
          type: "pfp",
          file: img.file,
          tags: img.tags,
          src: `/pfps/images/${img.file}`
        }))
      : [];

    const bannerList = Array.isArray(window.bannerImages)
      ? window.bannerImages.map(img => ({
          type: "banner",
          file: img.file,
          tags: img.tags,
          src: `/banners/images/${img.file}`
        }))
      : [];

    const combined = [...pfpList, ...bannerList];
    shuffleArray(combined);
    // Expose a single, stable mixed source for getImageSource() to use
    window.exploreImages = combined;
  } catch (err) {
    console.error("Failed to prepare explore mixed feed", err);
  }
}
  
/*
    viewMode = "explore"; // future-proof
    index = 0;
    loadedImages.clear();
    createColumns();
    loadBatch();
  });

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
   INIT
========================= */
if (images.length) {
  // Load first batch
  loadBatch();
  
  // Preload second batch immediately for smoother initial scroll
  setTimeout(() => {
    if (index < getImageSource().length) {
      loadBatch();
    }
  }, 100);
}