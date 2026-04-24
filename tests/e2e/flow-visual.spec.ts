import { expect, test } from '@playwright/test';

const CANDIDATE = {
  name: 'Ana QA',
  email: 'ana.qa@example.com',
  role: 'People Ops',
};

async function goToConsent(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByPlaceholder('Nombre completo').fill(CANDIDATE.name);
  await page.getByPlaceholder('Correo electrónico').fill(CANDIDATE.email);
  await page.getByPlaceholder('Rol o puesto objetivo').fill(CANDIDATE.role);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Consentimiento informado')).toBeVisible();
}

async function goToWelcome(page: import('@playwright/test').Page) {
  await goToConsent(page);
  await page.getByText('Acepto términos de evaluación').click();
  await page.getByText('Acepto captura de datos conductuales').click();
  await page.getByRole('button', { name: /Continuar/i }).click();
  await expect(page.getByText('Te damos la bienvenida')).toBeVisible();
}

test.describe('visual regression - flujo base', () => {
  test('login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toHaveScreenshot('login-screen.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('consent screen', async ({ page }) => {
    await goToConsent(page);
    await expect(page.getByTestId('consent-screen')).toHaveScreenshot('consent-screen.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('welcome screen', async ({ page }) => {
    await goToWelcome(page);
    await expect(page.locator('div.min-h-screen').first()).toHaveScreenshot('welcome-screen.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
