// Tests de punta a punta: la app de verdad en un navegador, contra los
// emuladores de Firebase (nunca contra el proyecto real). Se corren con
// `npm run test:e2e`, que arranca los emuladores y luego estos tests.
import { defineConfig, devices } from '@playwright/test';

const PUERTO = 5199;

export default defineConfig({
  testDir: './e2e',
  // Los tests comparten los emuladores (y los vacían al empezar): de uno en uno
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
  },
  projects: [
    // La banda usa sobre todo tablets: una de 800 px en vertical
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 1200 } } },
  ],
  webServer: {
    command: `npm run dev --workspace=web -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Las variables del proceso mandan sobre el .env: un proyecto "demo-…" que
    // solo existe en los emuladores. config.js se niega a usar emuladores con
    // otro proyecto.
    env: {
      VITE_EMULADORES: '1',
      VITE_FIREBASE_API_KEY: 'clave-de-demo',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-notesheet.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-notesheet',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-notesheet.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
      VITE_FIREBASE_APP_ID: '1:0:web:0',
      VITE_FIREBASE_MEASUREMENT_ID: '',
      VITE_SENTRY_DSN: '',
      VITE_GETSONGBPM_API_KEY: '',
    },
  },
});
