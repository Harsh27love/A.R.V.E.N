import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' },watch:{ignored:['**/tests/**','**/docs/**','**/database/*.db*','**/.npm-cache/**','**/test-results/**','**/playwright-report/**']} },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
