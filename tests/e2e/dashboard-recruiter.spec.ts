import { expect, test } from '@playwright/test';

test.describe('dashboard recruiter/candidate views', () => {
  test('recruiter view muestra bloques de decision e insights', async ({ page }) => {
    await page.goto('/?debug_stage=results&debug_access=recruiter');

    await expect(page.getByText('Modo recruiter')).toBeVisible();
    await expect(page.getByTestId('recruiter-insights')).toBeVisible();
    await expect(page.getByTestId('recruiter-decision-card')).toBeVisible();
    await expect(page.getByTestId('recruiter-quickview-grid')).toBeVisible();
    await expect(page.getByTestId('recruiter-strengths')).toBeVisible();
    await expect(page.getByTestId('recruiter-risks')).toBeVisible();
    await expect(page.getByTestId('recruiter-interview-focus')).toBeVisible();
    await expect(page.getByTestId('recruiter-kpi-1')).toBeVisible();
    await expect(page.getByTestId('recruiter-insights-hint')).toBeVisible();
    await expect(page.getByTestId('recruiter-score-legend')).toBeVisible();
    await expect(page.getByTestId('signal-quality-card')).toBeVisible();
    await expect(page.getByTestId('profile-narrative')).toBeVisible();
    await expect(page.getByTestId('recruiter-executive-summary')).toBeVisible();
    await expect(page.getByTestId('recruiter-interview-guide')).toBeVisible();
    await expect(page.getByTestId('copy-summary-btn')).toBeVisible();
    await expect(page.getByText('Fortalezas clave')).toBeVisible();
    await expect(page.getByText('Debilidades observadas')).toBeVisible();
  });

  test('candidate view no muestra bloques recruiter y mantiene resumen candidato', async ({ page }) => {
    await page.goto('/?debug_stage=results&debug_access=candidate');

    await expect(page.getByText('Modo candidato')).toBeVisible();
    await expect(page.getByTestId('candidate-summary')).toBeVisible();
    await expect(page.getByTestId('recruiter-insights')).toHaveCount(0);
    await expect(page.getByTestId('candidate-score-legend')).toBeVisible();
    await expect(page.getByTestId('signal-quality-card')).toBeVisible();
    await expect(page.getByTestId('candidate-fast-read')).toBeVisible();
    await expect(page.getByTestId('candidate-weekly-plan')).toBeVisible();
    await expect(page.getByTestId('copy-summary-btn')).toBeVisible();
  });
});
