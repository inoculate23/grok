import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: false,
    proxy: {
      // Dev proxy for Hugging Face Space MCP endpoint to avoid CORS and add headers
      '/hf-mcp': {
        target: 'https://prithivmlmods-multimodal-ocr.hf.space/gradio_api/mcp/',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/hf-mcp/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'application/json, text/event-stream');
            // Ensure content type is json for JSON-RPC POSTs
            if (!proxyReq.getHeader('Content-Type')) {
              proxyReq.setHeader('Content-Type', 'application/json');
            }
          });
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
