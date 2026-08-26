import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPages ? '/Hack4Sages_project/' : '/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    open: true,
    // WebR (R/WASM) requires cross-origin isolation for SharedArrayBuffer.
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        research: './research.html',
        further: './further_details.html',
      },
    },
  },
});
