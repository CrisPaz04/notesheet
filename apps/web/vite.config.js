import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { fileURLToPath } from 'node:url'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run web:red`: para abrir el servidor de desarrollo desde la tablet o
  // el móvil. Escucha en la red local y con HTTPS, porque el navegador solo
  // da el micrófono (el afinador) en https o en localhost. El certificado es
  // autofirmado: la primera vez el navegador avisa y hay que aceptarlo.
  const enRed = mode === 'red'

  // La versión desplegada, para Sentry: Netlify pone el commit en COMMIT_REF
  const version = process.env.COMMIT_REF || 'dev'
  // Subir los source maps a Sentry solo si hay token (en Netlify): así un error
  // apunta a la línea del código de verdad. Se borran del sitio tras subirlos,
  // para no publicar el código fuente.
  const subirMapas = Boolean(process.env.SENTRY_AUTH_TOKEN)

  return {
    plugins: [
      enRed && basicSsl({ name: 'notesheet-dev' }),
      react(),
      subirMapas && sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: version },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      }),
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          // pdf.js fuera del precache: son 400 KB de biblioteca y 1,4 MB de
          // worker, y se los tragaria en la instalacion tambien quien solo abre
          // canciones de texto. Las partituras sin red no son prioritarias
          // (PLAN-PARTITURAS-PDF.md): quien no tiene wifi tira de datos.
          // Si algun dia molesta, la solucion es una regla `CacheFirst` acotada
          // a estos dos archivos y a las descargas de Storage.
          globIgnores: ['**/pdfjs-*.js', '**/pdf.worker*'],
          // SPA: cualquier ruta cae en index.html
          navigateFallback: '/index.html',
          // El service worker no debe tocar las llamadas a Firebase: Firestore
          // ya trae su propia caché en IndexedDB y la autenticación necesita
          // llegar siempre a la red.
          navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
          // Las grabaciones del piano y la trompeta no van en el precache (~3 MB
          // que no necesita quien no abre el piano): se guardan la primera vez que se
          // piden, y desde ahí suenan también sin conexión
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/audio/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'piano-muestras',
                expiration: { maxEntries: 40 }
              }
            }
          ],
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
    server: enRed ? { host: true } : undefined,
    // El .env vive en la raiz del monorepo, no en apps/web
    envDir: fileURLToPath(new URL('../../', import.meta.url)),
    define: {
      __VERSION__: JSON.stringify(version),
    },
    build: {
      sourcemap: subirMapas ? 'hidden' : false,
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
  }
})
