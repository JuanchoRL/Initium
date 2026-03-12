import { expect, test } from '@playwright/test';

test('memory mismatch no se congela y avanza de ronda', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/?debug_game=memory');
  await expect(page.getByText('Ronda 1 / 5')).toBeVisible();
  await expect(page.getByText('Construir', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('memory-verify').click();
  await expect(page.getByText('Incorrecto', { exact: true })).toBeVisible({ timeout: 6_000 });

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Ronda 2 / 5')).toBeVisible({ timeout: 10_000 });

  expect(runtimeErrors, `Errores de runtime: ${runtimeErrors.join('\n')}`).toHaveLength(0);
});

test('network mantiene loop activo: baja el tiempo y genera paquetes', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/?debug_game=network');
  await expect(page.getByTestId('network-game')).toBeVisible();
  await expect(page.getByText('Sincronizados')).toBeVisible();

  const timerLocator = page.locator('[data-testid="network-hud"] >> text=/00:\\d{2}/').first();
  const initialTimerText = (await timerLocator.textContent())?.trim() || '00:60';
  const initialTimer = Number(initialTimerText.replace('00:', ''));

  await page.waitForTimeout(2_300);

  const currentTimerText = (await timerLocator.textContent())?.trim() || '00:60';
  const currentTimer = Number(currentTimerText.replace('00:', ''));

  expect(currentTimer).toBeLessThan(initialTimer);

  const state = await page.evaluate(() => {
    const raw = (window as any).render_game_to_text?.();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  expect(state).not.toBeNull();
  expect(Array.isArray(state.packets)).toBeTruthy();
  expect(state.timeLeft).toBeLessThanOrEqual(initialTimer - 1);

  expect(runtimeErrors, `Errores de runtime: ${runtimeErrors.join('\n')}`).toHaveLength(0);
});

test('risk refleja progreso circular al mantener presionado', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/?debug_game=risk');
  await expect(page.getByTestId('risk-game')).toBeVisible();

  const ackButton = page.getByRole('button', { name: 'Entendido' });
  if (await ackButton.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await ackButton.click();
  }

  const holdButton = page.getByRole('button', { name: /Mantener presionado/i });
  await expect(holdButton).toBeVisible();

  const progressCircle = page.locator('[data-testid="risk-gauge"] svg circle').nth(2);
  const beforeOffset = Number(await progressCircle.getAttribute('stroke-dashoffset'));

  const box = await holdButton.boundingBox();
  if (!box) throw new Error('No se pudo obtener bounding box del botón de hold.');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);

  const duringOffset = Number(await progressCircle.getAttribute('stroke-dashoffset'));
  await page.mouse.up();

  expect(duringOffset).toBeLessThan(beforeOffset);
  await page.waitForTimeout(350);
  await expect(page.getByTestId('risk-gauge')).toBeVisible();
  await expect(page.getByRole('button', { name: /Mantener presionado|Cargando|Siguiente prueba|Siguiente ronda|Ver resultado/i })).toBeVisible();

  expect(runtimeErrors, `Errores de runtime: ${runtimeErrors.join('\n')}`).toHaveLength(0);
});
