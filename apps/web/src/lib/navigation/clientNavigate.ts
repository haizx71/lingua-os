/**
 * SPA-Aware Client Navigation Helper
 *
 * Dispatches a 'lingua:navigate' CustomEvent and updates browser history without wiping in-memory state.
 */

export function clientNavigate(path: string): void {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Invalid navigation path: "${path}". Path must start with single "/".`);
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('lingua:navigate', { detail: { path } }));

  if (typeof window.history?.pushState === 'function') {
    try {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      try {
        window.location.assign(path);
      } catch {
        // Fallback for mock test environments where assignment is unsupported
      }
    }
  }
}
