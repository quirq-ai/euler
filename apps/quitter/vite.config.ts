import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: `${(process.env.QUIRQ_BASE_PATH || '').replace(/\/+$/, '')}/`,
  build: { outDir: process.env.QUIRQ_DIST_DIR || 'dist' },
  plugins: [react()],
  server: { watch: { usePolling: true } },
});
