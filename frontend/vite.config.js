import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api/v1/saas': {
        target: 'http://localhost:5003',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000,
        // AGGIUNGI QUESTO PER SSE:
        buffer: false,
        headers: {
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        },
        errorHandler: (err, req, res) => {
          console.error('Proxy Error:', err.code);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Backend Connection Failed',
            details: err.code,
            message: 'Il backend dell\'honeypot potrebbe essere in fase di riavvio.'
          }));
        }
      },
      '/admin': {
        target: 'http://localhost:5002',
        changeOrigin: true
      },
      '/trap': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trap/, '')
      }
    }
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})