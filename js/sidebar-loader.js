/**
 * Normalizes URL paths for comparison.
 * - Ensures leading slash
 * - Strips trailing slashes
 * - Removes index.html
 * @param {string} path - The path to normalize
 * @returns {string} - Normalized path
 */
function normalizePath(path) {
  // Ensure leading slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // Remove index.html
  path = path.replace(/\/index\.html$/, "");

  // Remove trailing slash (but keep root as "/")
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

/**
 * Navigation state object that manages active-link detection.
 * Computes normalized current path once and exposes helpers.
 */
const navState = (() => {
  const currentPath = normalizePath(location.pathname);

  return {
    /**
     * Check if a link (by href attribute) is active
     * @param {string} href - The href attribute value
     * @returns {boolean} - True if the link is active
     */
    isLinkActive(href) {
      return currentPath === normalizePath(href);
    },

    /**
     * Get the current normalized path
     * @returns {string} - The normalized current path
     */
    getCurrentPath() {
      return currentPath;
    }
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  fetch("/components/sidebar.html")
    .then(r => r.text())
    .then(html => {
      document.body.insertAdjacentHTML("afterbegin", html);
      highlightActiveLink();
    })
    .catch(err => console.error("Sidebar load failed", err));
});

/**
 * Map of default icon URLs to their filled equivalents
 */
const iconMapping = {
  "https://666forever.github.io/pfseeker-assets/icons/svg/home.svg": "https://666forever.github.io/pfseeker-assets/icons/svg/home-filled.svg",
  "https://666forever.github.io/pfseeker-assets/icons/svg/explore.svg": "https://666forever.github.io/pfseeker-assets/icons/svg/explore-filled.svg",
  "https://666forever.github.io/pfseeker-assets/icons/svg/pfps.svg": "https://666forever.github.io/pfseeker-assets/icons/svg/pfps-filled.svg",
  "https://666forever.github.io/pfseeker-assets/icons/svg/banners.svg": "https://666forever.github.io/pfseeker-assets/icons/svg/banners-filled.svg",
  "https://666forever.github.io/pfseeker-assets/icons/svg/heartsquare.svg": "https://666forever.github.io/pfseeker-assets/icons/svg/heartsquare-filled.svg"
};

/**
 * Highlights the navigation link matching the current page.
 * Swaps the icon to the filled variant and adds aria-current="page".
 */
function highlightActiveLink() {
  const navLinks = document.querySelectorAll(".sidebar .nav-icon-btn");

  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    const isActive = navState.isLinkActive(href);
    const img = link.querySelector("img");

    if (isActive) {
      // Set aria-current for accessibility
      link.setAttribute("aria-current", "page");

      // Swap icon to filled version if mapping exists
      if (img && iconMapping[img.src]) {
        img.src = iconMapping[img.src];
      }
    } else {
      // Remove aria-current from non-active links
      link.removeAttribute("aria-current");

      // Ensure non-active links use the default (outline) icon
      if (img) {
        // Find the default URL by checking if current src is a filled variant
        const filledUrl = img.src;
        const defaultUrl = Object.keys(iconMapping).find(
          key => iconMapping[key] === filledUrl
        );
        if (defaultUrl) {
          img.src = defaultUrl;
        }
      }
    }
  });
}