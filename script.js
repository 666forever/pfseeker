import { pfpImages } from "./gallery/pfp/images_list.js";
import { bannerImages } from "./gallery/banner/images_list.js";

const gallery = document.getElementById("gallery");

/* =========================
   HELPERS
========================= */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function buildWeightedFeed(pfps, banners, ratio = 6) {
  const feed = [];
  let p = 0, b = 0;

  while (p < pfps.length || b < banners.length) {
    for (let i = 0; i < ratio && p < pfps.length; i++) {
      feed.push({ type: "pfp", name: pfps[p++] });
    }
    if (b < banners.length) {
      feed.push({ type: "banner", name: banners[b++] });
    }
  }
  return feed;
}

function getColumnCount() {
  if (window.innerWidth <= 500) return 1;
  if (window.innerWidth <= 900) return 2;
  if (window.innerWidth <= 1400) return 4;
  return 6;
}

/* =========================
   FEED (RESHUFFLE ON LOAD)
========================= */
const pfps = [...pfpImages];
const banners = [...bannerImages];
shuffle(pfps);
shuffle(banners);

const baseFeed = buildWeightedFeed(pfps, banners, 6);

/* =========================
   STATE
========================= */
let filterMode = "all";
let index = 0;

let COLUMN_COUNT = getColumnCount();
const BATCH_SIZE = 36;

const likedImages = new Set(
  JSON.parse(localStorage.getItem("likedImages") || "[]")
);
const loaded = new Set();

/* =========================
   PAGE MODE (AUTO FILTER)
========================= */
const pageMode =
  document.querySelector('meta[name="pfseeker-mode"]')?.content || "all";

if (pageMode === "pfp") filterMode = "pfp";
if (pageMode === "banner") filterMode = "banner";

/* =========================
   MODAL
========================= */
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const modalClose = document.querySelector(".modal-close");
const modalOverlay = document.querySelector(".modal-overlay");
const modalLikeBtn = document.getElementById("modalLikeBtn");

let modalIndex = -1;

/* =========================
   FEED FILTERING
========================= */
function getActiveFeed() {
  if (filterMode === "banner") return baseFeed.filter(i => i.type === "banner");
  if (filterMode === "pfp") return baseFeed.filter(i => i.type === "pfp");
  if (filterMode === "liked")
    return baseFeed.filter(i =>
      likedImages.has(`${i.type}/${i.name}`)
    );
  return baseFeed;
}

/* =========================
   MODAL LOGIC
========================= */
function openModal(item) {
  const feed = getActiveFeed();
  modalIndex = feed.indexOf(item);

  modalImg.src = `gallery/${item.type}/${item.name}`;
  modal.classList.remove("hidden");

  modalLikeBtn.classList.toggle(
    "liked",
    likedImages.has(`${item.type}/${item.name}`)
  );
}

function closeModal() {
  modal.classList.add("hidden");
  modalImg.src = "";
  modalIndex = -1;
}

modalClose.onclick = modalOverlay.onclick = closeModal;

/* =========================
   LIKE LOGIC (SINGLE SOURCE)
========================= */
function toggleLike(key) {
  likedImages.has(key)
    ? likedImages.delete(key)
    : likedImages.add(key);

  localStorage.setItem("likedImages", JSON.stringify([...likedImages]));

  // sync cards
  document
    .querySelectorAll(`.card[data-key="${key}"] .like-btn`)
    .forEach(btn =>
      btn.classList.toggle("liked", likedImages.has(key))
    );

  // sync modal
  modalLikeBtn.classList.toggle("liked", likedImages.has(key));

  // remove in liked-only view
  if (filterMode === "liked" && !likedImages.has(key)) {
    document.querySelector(`.card[data-key="${key}"]`)?.remove();
  }
}

modalLikeBtn.onclick = () => {
  const item = getActiveFeed()[modalIndex];
  if (!item) return;
  toggleLike(`${item.type}/${item.name}`);
};

/* =========================
   COLUMNS
========================= */
const columns = [];

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

/* =========================
   CREATE CARD (FIXED)
========================= */
function createCard(item) {
  const key = `${item.type}/${item.name}`;

  const card = document.createElement("div");
  card.className = `card ${item.type}`;
  card.dataset.key = key; // 🔴 CRITICAL FIX

  const img = document.createElement("img");
  img.src = `gallery/${item.type}/${item.name}`;
  img.loading = "lazy";
  img.decoding = "async";
  img.onload = () => img.classList.add("loaded");

  // double-click like
  img.addEventListener("dblclick", e => {
    e.preventDefault();
    toggleLike(key);
  });

  // double-tap like
  let lastTap = 0;
  img.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      toggleLike(key);
      lastTap = 0;
    } else lastTap = now;
  });

  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.innerHTML = `<span class="material-symbols-outlined">favorite</span>`;
  if (likedImages.has(key)) likeBtn.classList.add("liked");

  likeBtn.onclick = e => {
    e.stopPropagation();
    toggleLike(key);
  };

  const enlargeBtn = document.createElement("button");
  enlargeBtn.className = "enlarge-btn";
  enlargeBtn.innerHTML = `<span class="material-symbols-outlined">fit_screen</span>`;
  enlargeBtn.onclick = e => {
    e.stopPropagation();
    openModal(item);
  };

  card.append(img, enlargeBtn, likeBtn);
  return card;
}

/* =========================
   LOAD BATCH
========================= */
function loadBatch() {
  const feed = getActiveFeed();

  feed.slice(index, index + BATCH_SIZE).forEach((item, i) => {
    const key = `${item.type}/${item.name}`;
    if (loaded.has(key)) return;
    loaded.add(key);

    columns[(index + i) % COLUMN_COUNT].appendChild(
      createCard(item)
    );
  });

  index += BATCH_SIZE;
}

let resizeTimeout;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);

  resizeTimeout = setTimeout(() => {
    const newCount = getColumnCount();
    if (newCount !== COLUMN_COUNT) {
      index = 0;
      loaded.clear();
      createColumns();
      loadBatch();
    }
  }, 150);
});

/* =========================
   INFINITE SCROLL
========================= */
const sentinel = document.createElement("div");
gallery.after(sentinel);

new IntersectionObserver(
  ([e]) => e.isIntersecting && loadBatch(),
  { rootMargin: "600px" }
).observe(sentinel);

/* =========================
   NAVBAR FILTERS
========================= */
document.querySelectorAll(".dropdown-item").forEach(btn => {
  btn.onclick = () => {
    filterMode = btn.dataset.filter;
    index = 0;
    loaded.clear();
    createColumns();
    loadBatch();
  };
});

document.querySelector('[aria-label="Liked"]').onclick = () => {
  filterMode = "liked";
  index = 0;
  loaded.clear();
  createColumns();
  loadBatch();
};

/* =========================
   INIT
========================= */
createColumns();
loadBatch();

/* =========================
   PAGE LOAD FADE-OUT
========================= */
window.addEventListener("load", () => {
  const loader = document.getElementById("page-loader");
  if (!loader) return;

  // small delay so it feels intentional
  setTimeout(() => {
    loader.classList.add("fade-out");

    // remove after transition
    setTimeout(() => loader.remove(), 800);
  }, 100);
});
