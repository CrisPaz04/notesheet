import { test, expect } from '@playwright/test';

// La portada no necesita cuenta: la demo usa el mismo motor que la canción
test('la demo de la portada cambia la tonalidad con el instrumento', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cada músico, su parte en su tonalidad');

  const demo = page.getByRole('region', { name: /pruébalo/i });
  await expect(demo.getByTestId('demo-tonalidad')).toContainText('SIm');

  await demo.getByRole('button', { name: 'Saxo alto' }).click();
  await expect(demo.getByTestId('demo-tonalidad')).toContainText('FA#m');
  await expect(demo.getByTestId('demo-notas')).toContainText('DO# DO# SI SI');
});

test('quien solo tiene un código llega a la pantalla para escribirlo', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('link', { name: 'Entrar con el código' }).click();
  await expect(page).toHaveURL(/\/live$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar a una sesión');
});
