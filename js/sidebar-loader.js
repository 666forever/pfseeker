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
      initMobileMenu(); // Initialize mobile menu after sidebar loads
      initMobileSearch(); // Initialize mobile search
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

/**
 * Initialize mobile menu functionality
 * Handles hamburger button, close button, and backdrop clicks
 */
function initMobileMenu() {
  const mobileSidebar = document.querySelector('.mobile-sidebar');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileCloseBtn = document.querySelector('.mobile-sidebar-close');
  const backdrop = document.querySelector('.mobile-backdrop');

  if (!mobileSidebar || !mobileMenuBtn || !mobileCloseBtn || !backdrop) {
    console.warn('Mobile menu elements not found');
    return;
  }

  // Open menu
  function openMenu() {
    mobileSidebar.classList.add('open');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent body scroll
  }

  // Close menu
  function closeMenu() {
    mobileSidebar.classList.remove('open');
    backdrop.classList.remove('active');
    document.body.style.overflow = ''; // Restore body scroll
  }

  // Toggle menu (open if closed, close if open)
  function toggleMenu() {
    if (mobileSidebar.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // Hamburger button click - TOGGLE instead of just open
  mobileMenuBtn.addEventListener('click', toggleMenu);

  // Close button click
  mobileCloseBtn.addEventListener('click', closeMenu);

  // Backdrop click
  backdrop.addEventListener('click', closeMenu);

  // Close menu when navigation link is clicked (mobile)
  const navLinks = mobileSidebar.querySelectorAll('.mobile-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileSidebar.classList.contains('open')) {
      closeMenu();
    }
  });
}

/**
 * Initialize mobile search functionality
 * Handles search button and close button clicks
 */
function initMobileSearch() {
  const searchBtn = document.querySelector('.mobile-search-btn');
  const searchOverlay = document.querySelector('.mobile-search-overlay');
  const searchClose = document.querySelector('.mobile-search-close');
  const searchInput = document.querySelector('.mobile-search-input');
  const desktopSearchInput = document.querySelector('.search-bar input');

  if (!searchBtn || !searchOverlay || !searchClose || !searchInput) {
    console.warn('Mobile search elements not found');
    return;
  }

  // Open search overlay
  function openSearch() {
    searchOverlay.classList.remove('hidden');
    // Focus input after animation
    setTimeout(() => {
      searchInput.focus();
    }, 100);
  }

  // Close search overlay
  function closeSearch() {
    searchOverlay.classList.add('hidden');
    searchInput.blur();
  }

  // Perform search function
  function performSearch(query) {
    query = query.trim().toLowerCase();
    
    if (!query) {
      // Empty search - show all images (reset to 'all' tag filter)
      if (window.filterByTag) {
        window.filterByTag('all');
      }
      return;
    }

    // Trigger custom search event that script.js can listen to
    const searchEvent = new CustomEvent('pfseeker-search', {
      detail: { query: query }
    });
    document.dispatchEvent(searchEvent);
  }

  // Search button click
  searchBtn.addEventListener('click', openSearch);

  // Close button click
  searchClose.addEventListener('click', closeSearch);

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !searchOverlay.classList.contains('hidden')) {
      closeSearch();
    }
  });

  // Real-time search as user types (mobile)
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    // Sync with desktop search
    if (desktopSearchInput) {
      desktopSearchInput.value = query;
    }
    // Perform search in real-time
    performSearch(query);
  });

  // Handle search on Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      performSearch(query);
    }
  });

  // Desktop search input integration
  if (desktopSearchInput) {
    desktopSearchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      // Sync with mobile search
      searchInput.value = query;
      // Perform search
      performSearch(query);
    });
  }
}