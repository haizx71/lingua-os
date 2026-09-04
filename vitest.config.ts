import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/frontend/setup.ts'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@lingua/types': path.resolve(__dirname, './packages/types/src'),
      '@lingua/ui': path.resolve(__dirname, './packages/ui/src'),
      '@': path.resolve(__dirname, './apps/web/src'),
      'gsap': path.resolve(__dirname, './packages/ui/node_modules/gsap'),
      '@gsap/react': path.resolve(__dirname, './packages/ui/node_modules/@gsap/react'),
    },
  },
});

