import { expect, test } from '@playwright/test';

test('new budget is empty, configurable, persistent, and responsive', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Votre argent/ })).toBeVisible();
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByPlaceholder('Ex. Revenu mensuel').fill('Revenu principal');
  await page.getByPlaceholder('0,00').fill('2000');
  await page.getByRole('button', { name: /Ouvrir mon espace/ }).click();
  await expect(page.getByText('2\u00a0000,00\u00a0€')).toBeVisible();

  await page.getByRole('button', { name: 'Changer le thème' }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveClass(/dark/);
  await expect(page.getByText('2\u00a0000,00\u00a0€')).toBeVisible();
});

test('layout adapts to a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('button', { name: 'Je préfère tout configurer plus tard' }).click();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});
