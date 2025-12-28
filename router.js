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
