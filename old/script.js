
/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadGallery(); // only runs on gallery pages
});


/* ============================================================
   GALLERY — FIX C (Perfect layout before reveal)
============================================================ */
async function loadGallery() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  const loadingIndicator = document.getElementById("loading-indicator");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector("img");

  const closeBtn = lightbox.querySelector(".close");
  const prevBtn = lightbox.querySelector(".prev");
  const nextBtn = lightbox.querySelector(".next");

  let images = [];
  let currentIndex = 0;
  let loadedCount = 0;
  const batchSize = 25;
  let isLoading = false;
  let allLoaded = false;

  try {
    const res = await fetch("images_list.json");
    images = await res.json();
  } catch (err) {
    console.error("Could not load images_list.json");
    return;
  }

  let msnry = null;

  function altText(name) {
    return name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  }

  function addImage(imgName, index) {
    const div = document.createElement("div");
    div.className = "grid-item";

    const img = document.createElement("img");
    img.src = `images/${imgName}`;
    img.alt = altText(imgName);
    img.loading = "lazy";

    img.onload = () => {
      div.classList.add("loaded");
      if (msnry) {
        msnry.appended(div);
        msnry.layout();
      }
    };

    img.addEventListener("click", () => openLightbox(index));

    div.appendChild(img);
    gallery.appendChild(div);
  }

  function loadBatch() {
    if (isLoading || allLoaded) return;
    isLoading = true;

    loadingIndicator.classList.remove("hidden");

    const batch = images.slice(loadedCount, loadedCount + batchSize);

    batch.forEach((name, i) => addImage(name, loadedCount + i));

    loadedCount += batch.length;

    if (loadedCount >= images.length) {
      allLoaded = true;
      loadingIndicator.classList.add("hidden");
    }

    setTimeout(() => { isLoading = false; }, 350);
  }

  function initMasonryAfterImagesLoaded() {
    imagesLoaded(gallery, () => {
      msnry = new Masonry(gallery, {
        itemSelector: ".grid-item",
        columnWidth: ".grid-sizer",
        gutter: 24,
        percentPosition: true,
        horizontalOrder: true,
        transitionDuration: "0s"
      });

      document.body.classList.add("grid-ready");
    });
  }

  window.addEventListener("scroll", () => {
    if (!isLoading &&
        !allLoaded &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 700) {
      loadBatch();
    }
  });

  loadBatch();
  initMasonryAfterImagesLoaded();

  /* ------------------------------
     LIGHTBOX
     ------------------------------ */
  function preload(idx) {
    const x = (idx + images.length) % images.length;
    new Image().src = `images/${images[x]}`;
  }

  function openLightbox(index) {
    currentIndex = index;
    lightboxImg.src = `images/${images[currentIndex]}`;
    lightbox.style.display = "flex";

    requestAnimationFrame(() => {
      lightbox.classList.add("show");
      lightbox.setAttribute("aria-hidden", "false");
    });

    preload(currentIndex + 1);
    preload(currentIndex - 1);
  }

  function closeLightbox() {
    lightbox.classList.remove("show");
    lightbox.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      lightbox.style.display = "none";
      lightboxImg.src = "";
    }, 250);
  }

  closeBtn.onclick = closeLightbox;

  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    lightboxImg.src = `images/${images[currentIndex]}`;
    preload(currentIndex - 1);
  };

  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % images.length;
    lightboxImg.src = `images/${images[currentIndex]}`;
    preload(currentIndex + 1);
  };

  lightbox.addEventListener("click", e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", e => {
    if (lightbox.style.display !== "flex") return;

    if (e.key === "ArrowLeft") prevBtn.click();
    if (e.key === "ArrowRight") nextBtn.click();
    if (e.key === "Escape") closeLightbox();
  });
}
