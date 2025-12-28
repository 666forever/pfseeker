// Simple client-side router for SPA navigation
export class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.navigate(window.location.pathname, false);
    });
    
    // Intercept navigation link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.navigate(route);
      }
    });
  }
  
  addRoute(path, callback) {
    this.routes.set(path, callback);
  }
  
  navigate(path, pushState = true) {
    // Normalize path
    if (path === '/index.html') path = '/'; // Only normalize index.html, keep / as /
    
    // Remove trailing slashes for consistency (except for root)
    if (path !== '/') {
      path = path.replace(/\/$/, '');
    }
    if (path === '') path = '/';
    
    const route = this.routes.get(path);
    
    if (!route) {
      console.warn(`No route found for: ${path}`);
      // Default to / (home) if route not found
      this.navigate('/', pushState);
      return;
    }
    
    // Update browser URL without reloading page
    if (pushState) {
      window.history.pushState({}, '', path);
    }
    
    // Update active navigation link styling
    this.updateActiveNav(path);
    
    // Store current route
    this.currentRoute = path;
    
    // Call the route's callback function
    route();
  }
  
  updateActiveNav(path) {
    // Reset icons for all nav links and remove active class
    document.querySelectorAll('.nav-icon-btn').forEach(link => {
      link.classList.remove('active');
      const icon = link.querySelector('img.nav-icon');
      if (icon && icon.src) {
        // replace any -filled.svg suffix with .svg
        icon.src = icon.src.replace(/-filled\.svg$/, '.svg');
      }
    });

    // Add active class to current route's link and swap its icon
    const activeLink = document.querySelector(`[data-route="${path}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      const icon = activeLink.querySelector('img.nav-icon');
      if (icon && icon.src) {
        icon.src = icon.src.replace(/\.svg$/, '-filled.svg');
      }
    }
  }
  
  init() {
    // Navigate to current URL on page load
    this.navigate(window.location.pathname, false);
  }
  
  getCurrentRoute() {
    return this.currentRoute;
  }
}

// Create and export global router instance
export const router = new Router();
