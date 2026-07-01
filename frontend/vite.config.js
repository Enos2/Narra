/* eslint-disable no-undef */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      closeBundle() {
        const publicDir = resolve(__dirname, 'public')
        const distDir = resolve(__dirname, 'dist')
        const sourceFile = resolve(publicDir, '_redirects')
        const destFile = resolve(distDir, '_redirects')
        
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
        
        if (existsSync(sourceFile)) {
          try {
            copyFileSync(sourceFile, destFile)
            console.log('✅ _redirects copied to dist')
          } catch (err) {
            console.warn('⚠️ Could not copy _redirects:', err.message)
          }
        } else {
          console.warn('⚠️ _redirects not found in public folder')
        }
      }
    }
  ],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    rolldownOptions: {
      define: {
        'global': 'globalThis'
      }
    }
  }
})