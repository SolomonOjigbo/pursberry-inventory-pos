import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Assets are loaded over file:// in the packaged app, so paths must be relative.
  base: './',
  server: { port: 5175, strictPort: true },
  build: { outDir: 'dist', sourcemap: true, emptyOutDir: true },
});
