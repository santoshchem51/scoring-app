/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => ({
  server: {
    fs: {
      // Allow Vite to serve files from the worktree's own node_modules
      // and the main project's node_modules (worktree shares some packages)
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, '../../..'), // ScoringApp root
      ],
    },
  },
  plugins: [
    solid({ hot: mode !== 'test' }),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PickleScore',
        short_name: 'PickleScore',
        description: 'Pickleball scoring, tournament management, and live results',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__\//, /\/[^/?]+\.[^/]+$/],
        cleanupOutdatedCaches: true,
        dontCacheBustURLsMatching: /\.[a-f0-9]{8}\./,
        cacheId: 'picklescore',
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.+\.(js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vite-assets',
              expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/fonts\/.+\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-profile-photos',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@testing-library/jest-dom/vitest': path.resolve(
        __dirname,
        'node_modules/@testing-library/jest-dom/dist/vitest.mjs'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', '**/node_modules/**', 'test/rules/**', 'test/integration/**', '.worktrees/**'],
    deps: {
      optimizer: {
        web: {
          include: ['solid-js', '@solidjs/router'],
        },
      },
    },
  },
}));
