import { test, expect } from '@playwright/test';
import { vaciar, crearCuenta, crearDocumento, subirArchivo, pdfDePrueba } from './emuladores.js';

// Lo único de los permisos de las partituras que su dueño no puede ver desde
// su cuenta: que otro músico, con la suya, abra la partitura de una canción
// publicada (las reglas de Storage leen la canción en Firestore para decidir)
// y no la de una privada. Con las reglas de verdad, en los emuladores.
const DUENO = { email: 'dueno@banda.test', password: 'clave-de-prueba-123', nombre: 'Dueño' };
const MUSICO = { email: 'musico@banda.test', password: 'clave-de-prueba-456', nombre: 'Músico' };

const cancionEnPdf = async (id, title, publica, duenoUid) => {
  const ruta = `partituras/${id}/bb_trumpet-1-partitura.pdf`;
  await subirArchivo(ruta, pdfDePrueba(`Partitura de ${title}`), 'application/pdf');
  const ahora = new Date();
  await crearDocumento('songs', id, {
    userId: duenoUid, public: publica, title, key: 'DO', type: 'Adoración', format: 'pdf',
    primaryInstrument: 'bb_trumpet', primaryVoiceNumber: '1',
    pdfs: { bb_trumpet: { 1: { partitura: ruta } } },
    createdAt: ahora, updatedAt: ahora,
  });
};

test.beforeEach(async () => {
  await vaciar();
  const duenoUid = await crearCuenta(DUENO.email, DUENO.password, DUENO.nombre);
  await crearCuenta(MUSICO.email, MUSICO.password, MUSICO.nombre);
  await cancionEnPdf('popurri', 'Popurrí publicado', true, duenoUid);
  await cancionEnPdf('privada', 'Arreglo privado', false, duenoUid);
});

const entrar = async (page, { email, password }) => {
  await page.goto('/login');
  await page.getByPlaceholder('nombre@ejemplo.com').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
};

test('otro músico, con su cuenta, ve pintada la partitura de una canción publicada', async ({ page }) => {
  await entrar(page, MUSICO);
  await page.goto('/songs/popurri');
  await expect(page.getByRole('heading', { name: 'Popurrí publicado' })).toBeVisible();

  // pdf.js la pinta en un canvas: si Storage la negara, no habría página
  const pagina = page.locator('.pdf-score-pages canvas').first();
  await expect(pagina).toBeVisible({ timeout: 20000 });
  expect(await pagina.evaluate((c) => c.width)).toBeGreaterThan(0);
  await expect(page.getByText(/No se pudo abrir el PDF/)).toHaveCount(0);
});

test('la de una canción privada de otro no la puede abrir', async ({ page }) => {
  await entrar(page, MUSICO);
  await page.goto('/songs/privada');
  await expect(page.getByText(/Error al cargar la canción/)).toBeVisible();
  await expect(page.locator('.pdf-score-pages canvas')).toHaveCount(0);
});
