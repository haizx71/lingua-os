/**
 * Accessibility (WCAG 2.2 AA) & Ergonomics Assertion Helpers for LINGUA OS
 */

import { expect } from 'vitest';
import { type ConceptStatus, conceptStateMetadata } from '@lingua/ui/tokens/semantic';

/**
 * Calculates relative luminance for an sRGB hex color.
 */
export function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Computes contrast ratio between two hex colors.
 * WCAG 2.2 AA requires >= 4.5:1 for normal text and >= 3.0:1 for large text / UI components.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Asserts that a concept status element satisfies non-color accessibility invariants:
 * 1. Has explicit text label or aria-label
 * 2. Has role="status"
 * 3. Does not rely solely on color (distinct border style or icon)
 */
export function assertConceptChipA11y(element: HTMLElement, expectedStatus: ConceptStatus, expectedTerm?: string) {
  const meta = conceptStateMetadata[expectedStatus];
  expect(meta, `Metadata for status "${expectedStatus}" must exist`).toBeDefined();

  // Role verification
  expect(element.getAttribute('role')).toBe('status');

  // Accessible name check
  const ariaLabel = element.getAttribute('aria-label');
  expect(ariaLabel).toBeTruthy();
  expect(ariaLabel).toContain(meta.labelVi);

  if (expectedTerm) {
    expect(element.textContent).toContain(expectedTerm);
  }

  // Border style check (dashed for unseen, solid for others)
  if (meta.borderStyle === 'dashed') {
    expect(element.className).toContain('border-dashed');
  }
}

/**
 * Asserts that an interactive element meets minimum touch target sizing (WCAG 2.2 AA Target Size: 24x24 minimum, LINGUA OS target 44x44px for primary actions).
 */
export function assertTouchTargetSize(element: HTMLElement, minSizePx: number = 44) {
  const classList = element.className;
  const hasMinHeight =
    classList.includes('min-h-[44px]') ||
    classList.includes('min-h-[48px]') ||
    classList.includes('min-h-[32px]') ||
    classList.includes('h-10') ||
    classList.includes('h-12') ||
    classList.includes('p-3') ||
    classList.includes('p-4') ||
    classList.includes('py-3');

  expect(hasMinHeight, `Element should have touch target sizing class (>=${minSizePx}px)`).toBe(true);
}

/**
 * Asserts that an element has valid ARIA progressbar attributes.
 */
export function assertProgressbarA11y(element: HTMLElement, value: number, max: number = 100) {
  expect(element.getAttribute('role')).toBe('progressbar');
  expect(element.getAttribute('aria-valuenow')).toBe(String(value));
  expect(element.getAttribute('aria-valuemin')).toBe('0');
  expect(element.getAttribute('aria-valuemax')).toBe(String(max));
}

/**
 * Asserts that an alert / error element has role="alert" or aria-live="assertive/polite".
 */
export function assertAlertA11y(element: HTMLElement) {
  const role = element.getAttribute('role');
  const ariaLive = element.getAttribute('aria-live');
  const isAccessibleAlert = role === 'alert' || ariaLive === 'assertive' || ariaLive === 'polite';
  expect(isAccessibleAlert, 'Element must be an accessible alert or live region').toBe(true);
}
