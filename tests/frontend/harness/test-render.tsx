/**
 * Custom Test Renderer & Provider Wrappers for LINGUA OS Frontend Tests
 */

import React, { createContext, useContext } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MockApiService, defaultMockApiService } from './mock-api-service';

export interface TestProviderProps {
  children: React.ReactNode;
  apiService?: MockApiService;
  theme?: 'light' | 'dark';
  reducedMotion?: boolean;
}

export const ApiContext = createContext<MockApiService>(defaultMockApiService);
export const useTestApi = () => useContext(ApiContext);

export const ThemeContext = createContext<{ theme: 'light' | 'dark'; reducedMotion: boolean }>({
  theme: 'light',
  reducedMotion: false,
});
export const useTestTheme = () => useContext(ThemeContext);

export const TestWrapper: React.FC<TestProviderProps> = ({
  children,
  apiService = defaultMockApiService,
  theme = 'light',
  reducedMotion = false,
}) => {
  return (
    <ApiContext.Provider value={apiService}>
      <ThemeContext.Provider value={{ theme, reducedMotion }}>
        <div
          data-theme={theme}
          className={theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}
          style={reducedMotion ? { transitionDuration: '0s', animationDuration: '0s' } : undefined}
        >
          {children}
        </div>
      </ThemeContext.Provider>
    </ApiContext.Provider>
  );
};

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    apiService?: MockApiService;
    theme?: 'light' | 'dark';
    reducedMotion?: boolean;
  }
): RenderResult & { apiService: MockApiService } {
  const { apiService = defaultMockApiService, theme = 'light', reducedMotion = false, ...renderOptions } =
    options || {};

  const rendered = render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper apiService={apiService} theme={theme} reducedMotion={reducedMotion}>
        {children}
      </TestWrapper>
    ),
    ...renderOptions,
  });

  return {
    ...rendered,
    apiService,
  };
}

export * from '@testing-library/react';
