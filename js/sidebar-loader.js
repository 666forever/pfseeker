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

// No external icon URLs needed; sidebar uses inline SVG sprite with <use> elements.

/**
 * Highlights the navigation link matching the current page.
 * Swaps the icon to the filled variant and adds aria-current="page".
 */
function highlightActiveLink() {
  const navLinks = document.querySelectorAll(".sidebar .nav-icon-btn");
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    const isActive = navState.isLinkActive(href);
    const iconName = link.getAttribute('data-icon');
    const useEl = link.querySelector('.nav-icon use');

    if (isActive) {
      link.setAttribute('aria-current', 'page');
      if (useEl && iconName) useEl.setAttribute('href', `#icon-${iconName}-filled`);
      link.classList.add('active');
    } else {
      link.removeAttribute('aria-current');
      if (useEl && iconName) useEl.setAttribute('href', `#icon-${iconName}`);
      link.classList.remove('active');
    }
  });
}