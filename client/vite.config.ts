import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { vitePluginForArco } from '@arco-plugins/vite-react';

export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginForArco({ style: 'css' })],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
});
