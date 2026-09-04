import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mediaQueryList = window.matchMedia(QUERY);
  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', callback);
    return () => mediaQueryList.removeEventListener('change', callback);
  }
  // Fallback for legacy environments
  if (typeof (mediaQueryList as unknown as { addListener?: (cb: () => void) => void }).addListener === 'function') {
    (mediaQueryList as unknown as { addListener: (cb: () => void) => void }).addListener(callback);
    return () => {
      if (typeof (mediaQueryList as unknown as { removeListener?: (cb: () => void) => void }).removeListener === 'function') {
        (mediaQueryList as unknown as { removeListener: (cb: () => void) => void }).removeListener(callback);
      }
    };
  }
  return () => {};
}

function getSnapshot(): boolean {
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
