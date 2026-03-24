import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Environment Variables (create .env.local):
// VITE_SUPABASE_URL=your-supabase-project-url
// VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
// VITE_OPENAI_API_KEY=your-openai-key (optional, for development)
// VITE_GEMINI_API_KEY=your-gemini-key (optional, for development)
// VITE_GROQ_API_KEY=your-groq-key (optional, for development)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/services/openai.ts',
        'src/services/geminiLive.ts',
        'src/services/openaiRealtimeLive.ts',
      ],
      thresholds: {
        statements: 35,
        branches: 25,
        functions: 30,
        lines: 40,
      },
    },
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
