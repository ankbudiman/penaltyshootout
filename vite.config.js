import { defineConfig } from 'vite';

// base './' makes every asset path relative, so the build works from any
// GitHub Pages sub-path (https://user.github.io/repo-name/) and from a USB stick.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1500 },
  server: { port: 5173 },
});
