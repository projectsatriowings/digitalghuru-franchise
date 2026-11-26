import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: 'localhost',
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || process.env.BACKEND_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:5000'),
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        // Suppress benign ECONNRESET / EPIPE errors when client navigates away or SSE connection is refreshed
        configure: (proxy, _options) => {
          proxy.on('error', (err: any, _req, res: any) => {
            if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECONNABORTED') {
              // Expected when client disconnects SSE stream
              return;
            }
            console.error('[vite-proxy error]', err.message);
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
            }
          });
        },
      },
    },
  },
});
