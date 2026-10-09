import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Multi-page static build. Output goes to docs/ (served by GitHub Pages).
export default defineConfig({
  root: 'src/pages',
  publicDir: resolve(import.meta.dirname, 'public'),
  base: './',
  plugins: [vue()],
  server: { fs: { allow: [resolve(import.meta.dirname)] } },
  build: {
    outDir: resolve(import.meta.dirname, 'docs'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'src/pages/index.html'),
        'mcp-servers': resolve(import.meta.dirname, 'src/pages/mcp-servers.html'),
      },
    },
  },
  test: { root: resolve(import.meta.dirname), include: ['src/**/*.test.ts'] },
})
