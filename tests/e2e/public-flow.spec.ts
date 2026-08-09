import { expect, test } from '@playwright/test';

test.describe('ARSC Leaderboard public experience', () => {
  test('explains the verified participation flow without decorative claims', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Prestasi ARSC/i })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Cara kerja Leaderboard' })).toBeVisible();
    await expect(page.getByText('Hubungkan Rapor', { exact: true })).toBeVisible();
    await expect(page.getByText('Ajukan bukti kompetisi', { exact: true })).toBeVisible();
    await expect(page.getByText('Masuk setelah ditinjau', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Kontribusi kompetisi yang sudah diverifikasi/i })).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/top 10 leaderboard/i);
    expect(bodyText).not.toMatch(/real[- ]?time updates/i);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('keeps account creation short and defers identity fields to Rapor', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Masuk atau buat akun' })).toBeVisible();
    await page.getByRole('tab', { name: 'Buat akun' }).click();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Kata sandi')).toBeVisible();
    await expect(page.getByText(/Akun yang dibuat di sini juga dapat digunakan di Halo PSDM/i)).toBeVisible();
    await expect(page.getByLabel(/nama lengkap/i)).toHaveCount(0);
  });

  test('uses a compact mobile header without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menuButton = page.getByRole('button', { name: 'Buka menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole('link', { name: 'Peringkat anggota' })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
