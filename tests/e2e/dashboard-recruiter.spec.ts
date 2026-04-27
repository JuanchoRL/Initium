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
    await expect(page.getByTestId('candidate-score-legend')).toHaveCount(0);
    await expect(page.getByTestId('signal-quality-card')).toHaveCount(0);
    await expect(page.getByTestId('candidate-fast-read')).toHaveCount(0);
    await expect(page.getByTestId('candidate-weekly-plan')).toHaveCount(0);
    await expect(page.getByTestId('copy-summary-btn')).toBeVisible();
  });

  test('admin logout no pierde la sesion antes de persistir el cierre', async ({ page, request }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const loginResponse = await request.post('/api/admin/recruiter-access', {
      data: {
        action: 'login',
        name: 'QA Recruiter',
        email: 'qa-recruiter@example.com',
      },
    });
    expect(loginResponse.ok()).toBeTruthy();

    const { session } = (await loginResponse.json()) as {
      session: {
        sessionId: string;
        name: string;
        email: string;
        createdAt: number;
        persistedAt?: string;
      };
    };

    await page.addInitScript((recruiterSession) => {
      window.sessionStorage.setItem('initium_recruiter_session_v1', JSON.stringify(recruiterSession));
    }, session);

    await page.goto('/es/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard de recruiting' })).toBeVisible();

    await page.getByRole('button', { name: /QA Recruiter/i }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/es$/);
    expect(consoleErrors.filter((message) => message.includes('Recruiter session required'))).toHaveLength(0);
  });
});
