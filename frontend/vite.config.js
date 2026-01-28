import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stats': 'http://localhost:4002',
      '/auth': 'http://localhost:4002',
      '/api': 'http://localhost:4002'
    }
  }
})
