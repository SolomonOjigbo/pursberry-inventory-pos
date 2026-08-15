import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // The super-admin panel talks to /platform, never to tenant-facing /v1 —
      // it authenticates against a separate role hierarchy (plan §4.9).
      '/platform': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
