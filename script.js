import { pfpImages } from "./gallery/pfp/images_list.js";
import { bannerImages } from "./gallery/banner/images_list.js";

/* =========================
   PAGE MODE
========================= */
const pageMode =
  document.querySelector('meta[name="pfseeker-mode"]')?.content || "all";

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
const BATCH_SIZE = 36;
let index = 0;
let viewMode = "all";

const loadedImages = new Set();
const likedImages = new Set(
  JSON.parse(localStorage.getItem("likedImages") || "[]")
);

/* =========================
   COLUMNS (RESPONSIVE)
========================= */
const columns = [];
let COLUMN_COUNT = getColumnCount();

function getColumnCount() {
  if (window.innerWidth <= 500) return 1;
  if (window.innerWidth <= 900) return 2;
  if (window.innerWidth <= 1400) return 4;
  return 6;
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
}

createColumns();

/* =========================
   SHUFFLE + MIXED FEED
========================= */
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const mixedFeed = (() => {
  const pfps = shuffle(pfpImages);
  const banners = shuffle(bannerImages);

  const result = [];
  let bi = 0;

  pfps.forEach((pfp, i) => {
    result.push({ type: "pfp", file: pfp });

    if ((i + 1) % 6 === 0 && banners[bi]) {
      result.push({ type: "banner", file: banners[bi++] });
    }
  });

  return result;
})();

/* =========================
   IMAGE SOURCE
========================= */
function getImageSource() {
  if (viewMode === "liked") {
    return [...likedImages].map(f => ({
      type: f.startsWith("banner/") ? "banner" : "pfp",
      file: f.replace(/^banner\/|^pfp\//, "")
    }));
  }

  if (pageMode === "pfp") return pfpImages.map(f => ({ type: "pfp", file: f }));
  if (pageMode === "banner") return bannerImages.map(f => ({ type: "banner", file: f }));

  return mixedFeed;
}

/* =========================
   CREATE CARD
========================= */
function createCard(filename, type) {
  const card = document.createElement("div");
  card.className = `card ${type}`;

  const img = document.createElement("img");
  const src =
    type === "banner"
      ? `gallery/banner/${filename}`
      : `gallery/pfp/${filename}`;

  img.src = src;
  img.alt = filename;
  img.loading = "lazy";
  img.decoding = "async";

  img.addEventListener("load", () => img.classList.add("loaded"));
  img.addEventListener("error", () => card.remove());

  /* DOUBLE CLICK / DOUBLE TAP LIKE */
  let lastTap = 0;
  img.addEventListener("click", e => {
    const now = Date.now();
    if (now - lastTap < 300) {
      toggleLike(filename, type);
    }
    lastTap = now;
  });

  /* LIKE BUTTON */
  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.innerHTML = `<span class="material-symbols-outlined">favorite</span>`;

  if (likedImages.has(`${type}/${filename}`)) {
    likeBtn.classList.add("liked");
  }

  likeBtn.addEventListener("click", e => {
    e.stopPropagation();
    toggleLike(filename, type);
    likeBtn.classList.toggle("liked");
  });

  /* ENLARGE BUTTON */
  const enlargeBtn = document.createElement("button");
  enlargeBtn.className = "enlarge-btn";
  enlargeBtn.innerHTML = `<span class="material-symbols-outlined">fit_screen</span>`;
  enlargeBtn.addEventListener("click", e => {
    e.stopPropagation();
    openModal(src, filename, type);
  });

  card.append(img, enlargeBtn, likeBtn);
  return card;
}

/* =========================
   LIKE LOGIC
========================= */
function toggleLike(filename, type) {
  const key = `${type}/${filename}`;

  if (likedImages.has(key)) {
    likedImages.delete(key);
  } else {
    likedImages.add(key);
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

  batch.forEach((item, i) => {
    const key = `${item.type}/${item.file}`;
    if (loadedImages.has(key)) return;

    loadedImages.add(key);
    const card = createCard(item.file, item.type);
    columns[(index + i) % COLUMN_COUNT].appendChild(card);
  });

  index += BATCH_SIZE;
}

/* =========================
   INFINITE SCROLL
========================= */
const sentinel = document.createElement("div");
gallery.after(sentinel);

const observer = new IntersectionObserver(
  ([e]) => e.isIntersecting && loadBatch(),
  { rootMargin: "600px" }
);
observer.observe(sentinel);

/* =========================
   LIKED NAV BUTTON
========================= */
document
  .querySelector('[aria-label="Liked"]')
  ?.addEventListener("click", () => {
    viewMode = "liked";
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
      createColumns();
      loadBatch();
    }
  }, 150);
});

/* =========================
   INIT
========================= */
loadBatch();
