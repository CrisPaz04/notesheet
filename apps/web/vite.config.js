import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // El .env vive en la raiz del monorepo, no en apps/web
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  build: {
    rollupOptions: {
      output: {
        // Separar dependencias grandes para que no viajen en el bundle inicial
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          editor: ['easymde', 'react-simplemde-editor'],
          dnd: ['@hello-pangea/dnd'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
