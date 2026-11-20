
/**
 * File: frontend/vite.config.js
 * Purpose: Configure Vite and proxy frontend API requests to the Narra backend.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  base: '/'
})

/**
 * END OF FILE: frontend/vite.config.js
 */
