import { test, expect } from '@playwright/test';
import { vaciar, crearCuenta, crearDocumento } from './emuladores.js';

// El flujo de un domingo, de punta a punta y con dos navegadores: el director
// abre la sesión desde su lista, un músico sin cuenta entra con el código, y
// cuando el director baja la tonalidad, al músico le cambia sin recargar.
const DIRECTOR = { email: 'director@banda.test', password: 'clave-de-prueba-123', nombre: 'Director' };

test.beforeEach(async () => {
  await vaciar();
  const uid = await crearCuenta(DIRECTOR.email, DIRECTOR.password, DIRECTOR.nombre);
  const ahora = new Date();
  const cancion = (id, title, key, content) => crearDocumento('songs', id, {
    userId: uid, public: true, title, key, type: 'Adoración', content, createdAt: ahora, updatedAt: ahora,
  });
  await cancion('grande', 'Grande es el Señor', 'SIm', '## Coro\nFa# Fa# Mi Mi Fa# Mi Re Do# Si');
  await cancion('fiel', 'Eres fiel', 'FA#m', '## Intro\nRe# Fa# Re# Mi# Sol# Do#');
  await crearDocumento('playlists', 'domingo', {
    creatorId: uid, creatorName: DIRECTOR.nombre, name: 'Domingo', public: true, date: ahora,
    songs: [
      { id: 'grande', title: 'Grande es el Señor', key: 'SIm', originalKey: 'SIm' },
      { id: 'fiel', title: 'Eres fiel', key: 'FA#m', originalKey: 'FA#m' },
    ],
    createdAt: ahora, updatedAt: ahora,
  });
});

test('el director abre la sesión, un músico entra con el código y ve el cambio de tonalidad', async ({ page: director, browser }) => {
  // 1. El director inicia sesión y abre la sesión en vivo desde su lista
  await director.goto('/login');
  await director.getByPlaceholder('nombre@ejemplo.com').fill(DIRECTOR.email);
  await director.getByPlaceholder('Contraseña').fill(DIRECTOR.password);
  await director.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(director).toHaveURL(/\/dashboard/);

  await director.goto('/playlists/domingo');
  await expect(director.getByText('Grande es el Señor').first()).toBeVisible();
  await director.getByRole('button', { name: /sesión en vivo/i }).click();
  await expect(director).toHaveURL(/\/live\/[A-Z0-9]{6}$/);
  const codigo = director.url().split('/').pop();

  // 2. Un músico sin cuenta, en otra tablet, entra con el código
  const tablet = await browser.newContext({ viewport: { width: 800, height: 1200 }, locale: 'es-ES' });
  const musico = await tablet.newPage();
  await musico.goto('/live');
  await musico.getByPlaceholder('K7M2QX').fill(codigo);
  await musico.getByRole('button', { name: /entrar/i }).click();
  await musico.getByPlaceholder('Tu nombre').fill('Trompeta 2');
  await musico.getByRole('button', { name: 'Entrar a la sesión' }).click();

  const tarjetaMusico = musico.locator('.live-card', { hasText: 'Grande es el Señor' });
  await expect(tarjetaMusico).toBeVisible();
  await expect(tarjetaMusico.locator('.playlist-key-dropdown')).toHaveText('SIm');

  // 3. El director baja la tonalidad y al músico le cambia sola
  const tarjetaDirector = director.locator('.live-card', { hasText: 'Grande es el Señor' });
  await tarjetaDirector.locator('.playlist-key-dropdown').click();
  await tarjetaDirector.locator('.playlist-key-option', { hasText: /^SOLm$/ }).click();

  await expect(tarjetaMusico.locator('.playlist-key-dropdown')).toHaveText('SOLm');
  await expect(musico.locator('.live-card').filter({ hasText: 'Eres fiel' })).toBeVisible();

  await tablet.close();
});
