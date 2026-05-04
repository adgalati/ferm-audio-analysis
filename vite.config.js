import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        overlay: path.resolve(__dirname, 'overlay.html'),
      },
    },
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src')
      },
      {
        // Match any import of tonal-profile-loader.js (regardless of path)
        // and redirect to the browser version for the renderer
        find: /.*\/tonal-profile-loader\.js$/,
        replacement: path.resolve(__dirname, 'src/utils/tonal-profile-loader.browser.js')
      }
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
