import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      chunkSizeWarningLimit: 2500,
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          ws: true,
        },
      },
      // Disable Vite HMR to avoid iframe WebSocket proxy connection errors
      hmr: false,
      watch: {
        ignored: ['**/data/**', '**/salery_bingo_db.json', '**/.git/**']
      },
    },
  };
});
