import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  let mediaCleanup = () => {};
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mediaQueryList = window.matchMedia(QUERY);
    if (typeof mediaQueryList?.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', callback);
      mediaCleanup = () => mediaQueryList.removeEventListener('change', callback);
    } else if (typeof (mediaQueryList as unknown as { addListener?: (cb: () => void) => void })?.addListener === 'function') {
      (mediaQueryList as unknown as { addListener: (cb: () => void) => void }).addListener(callback);
      mediaCleanup = () => {
        if (typeof (mediaQueryList as unknown as { removeListener?: (cb: () => void) => void })?.removeListener === 'function') {
          (mediaQueryList as unknown as { removeListener: (cb: () => void) => void }).removeListener(callback);
        }
      };
    }
  }

  let observerCleanup = () => {};
  if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.documentElement) {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduced-motion'],
    });
    observerCleanup = () => observer.disconnect();
  }

  return () => {
    mediaCleanup();
    observerCleanup();
  };
}

function getSnapshot(): boolean {
  if (typeof document !== 'undefined' && document.documentElement?.dataset?.reducedMotion === 'true') {
    return true;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * SSR-safe React hook to detect user preference for reduced motion.
 * Subscribes to `(prefers-reduced-motion: reduce)` media query changes dynamically.
 *
 * @returns boolean `true` if prefers-reduced-motion is active, `false` otherwise.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
