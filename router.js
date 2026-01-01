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
  
  // Match a path against registered routes and extract parameters
  matchRoute(path) {
    // First try exact match
    if (this.routes.has(path)) {
      return { callback: this.routes.get(path), params: {} };
    }
    
    // Try pattern matching for dynamic routes
    for (const [pattern, callback] of this.routes.entries()) {
      if (!pattern.includes(':')) continue; // Skip if no parameters
      
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');
      
      if (patternParts.length !== pathParts.length) continue;
      
      const params = {};
      let matches = true;
      
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          // Parameter - extract it
          const paramName = patternParts[i].slice(1);
          params[paramName] = decodeURIComponent(pathParts[i]);
        } else if (patternParts[i] !== pathParts[i]) {
          // Static part doesn't match
          matches = false;
          break;
        }
      }
      
      if (matches) {
        return { callback, params };
      }
    }
    
    return null;
  }
  
  navigate(path, pushState = true) {
    // Normalize path
    if (path === '/index.html') path = '/'; // Only normalize index.html, keep / as /
    
    // Remove trailing slashes for consistency (except for root)
    if (path !== '/') {
      path = path.replace(/\/$/, '');
    }
    if (path === '') path = '/';
    
    const match = this.matchRoute(path);
    
    if (!match) {
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
    
    // Call the route's callback function with extracted parameters
    match.callback(match.params);
  }
  
  updateActiveNav(path) {
    // Remove active class and reset all icons to normal (outline)
    document.querySelectorAll('.nav-icon-btn').forEach(link => {
      link.classList.remove('active');
      const iconName = link.getAttribute('data-icon');
      const useElement = link.querySelector('.nav-icon use');
      if (useElement && iconName) {
        useElement.setAttribute('href', `#icon-${iconName}`);
      }
    });

    // Add active class and swap the clicked/current icon to filled version
    const activeLink = document.querySelector(`[data-route="${path}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      const iconName = activeLink.getAttribute('data-icon');
      const useElement = activeLink.querySelector('.nav-icon use');
      if (useElement && iconName) {
        useElement.setAttribute('href', `#icon-${iconName}-filled`);
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
