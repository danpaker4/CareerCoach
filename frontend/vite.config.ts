import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/users': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/github': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/chat': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/jobs': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/jobs-in-pipeline': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/skill-matcher': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/career-roadmap': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
})
