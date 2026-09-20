import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El músico no va a ver un aviso de "hay una versión nueva" en mitad
      // del culto: la app se actualiza sola en la siguiente carga.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'NoteSheet',
        short_name: 'NoteSheet',
        description: 'Partituras, listas, metrónomo y afinador para músicos de iglesia',
        lang: 'es',
        start_url: '/',
        scope: '/',
        // Pantalla completa: sobre el escenario estorba la barra del navegador
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0d6efd',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Las fuentes de bootstrap-icons no entran en el patrón por defecto,
        // y sin ellas los iconos salen como cuadros vacíos sin conexión.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // pdf.js fuera del precache: son 400 KB de biblioteca y 1,4 MB de
        // worker, y se los tragaria en la instalacion tambien quien solo abre
        // canciones de texto. Las partituras sin red no son prioritarias
        // (PLAN-PARTITURAS-PDF.md): quien no tiene wifi tira de datos.
        // Si algun dia molesta, la solucion es una regla `CacheFirst` acotada
        // a estos dos archivos y a las descargas de Storage.
        globIgnores: ['**/pdfjs-*.js', '**/pdf.worker*'],
        // La CSS de bootstrap-icons pide las fuentes con un hash de query
        // (`...woff2?dd6703...`) que no está en la clave del precache, así que
        // sin esto Workbox no las encuentra y los iconos desaparecen offline.
        // Ignorar todos los parámetros es seguro aquí: cada archivo
        // precacheado ya lleva su propio hash en el nombre.
        ignoreURLParametersMatching: [/.*/],
        // SPA: cualquier ruta cae en index.html
        navigateFallback: '/index.html',
        // El service worker no debe tocar las llamadas a Firebase: Firestore
        // ya trae su propia caché en IndexedDB y la autenticación necesita
        // llegar siempre a la red.
        navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      devOptions: {
        // Sin esto el service worker no existe en `npm run dev` y no se puede
        // probar el modo offline en local.
        enabled: false
      }
    })
  ],
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
          // Se sigue cargando solo cuando se abre una partitura (el import de
          // `lib/pdfjs.js` es dinamico). Esta aqui para que el archivo tenga
          // un nombre estable y `globIgnores` pueda apuntarlo.
          pdfjs: ['pdfjs-dist/legacy/build/pdf.mjs'],
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
