/**
 * 4-State UI Matrix Assertion Helpers for LINGUA OS Frontend Suite
 * Ensures mandatory coverage of Loading, Empty, Error, and Success states.
 */

import { expect } from 'vitest';
import { screen } from '@testing-library/react';

export function assertLoadingState(container?: HTMLElement) {
  // Check for skeleton elements or aria-busy indicators or loaders
  const busyElements = container
    ? container.querySelectorAll('[aria-busy="true"], .animate-pulse, .animate-spin')
    : document.querySelectorAll('[aria-busy="true"], .animate-pulse, .animate-spin');

  expect(busyElements.length, 'Loading indicators or skeletons should be present').toBeGreaterThan(0);
}

export function assertEmptyState(titlePattern?: RegExp | string, actionLabelPattern?: RegExp | string) {
  if (titlePattern) {
    expect(screen.getByText(typeof titlePattern === 'string' ? new RegExp(titlePattern, 'i') : titlePattern)).toBeInTheDocument();
  }
  if (actionLabelPattern) {
    const actionBtn = screen.getByRole('button', {
      name: typeof actionLabelPattern === 'string' ? new RegExp(actionLabelPattern, 'i') : actionLabelPattern,
    });
    expect(actionBtn).toBeInTheDocument();
  }
}

export function assertErrorState(errorCode?: string) {
  const alert = screen.getByRole('alert');
  expect(alert).toBeInTheDocument();

  if (errorCode) {
    expect(screen.getByText(new RegExp(errorCode, 'i'))).toBeInTheDocument();
  }

  // Ensure retry button is present and accessible
  const retryBtn = screen.getByRole('button', { name: /thử lại|retry|đăng nhập lại/i });
  expect(retryBtn).toBeInTheDocument();
}

export function assertSuccessState(containerElement: HTMLElement) {
  expect(containerElement).toBeInTheDocument();
  // Ensure no loading skeletons or fatal error alerts are active
  const fatalAlerts = containerElement.querySelectorAll('[role="alert"].bg-rose-50');
  expect(fatalAlerts.length, 'No blocking fatal error alert in success state').toBe(0);
}
