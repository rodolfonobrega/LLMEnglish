import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.smoke.test.ts'],
    setupFiles: ['./src/test/setup.ts', './src/test/smoke/setup.ts'],
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 120000,
  },
  server: {
    proxy: {
      '/api/groq': {
        target: 'https://api.groq.com/openai/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ''),
      },
    },
  },
})
