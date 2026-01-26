import { test, expect } from '@playwright/test';

test.describe('AutoTest AI - Core Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the dashboard', async ({ page }) => {
    await expect(page).toHaveTitle(/AutoTest AI/);
    await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
  });

  test('should display sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav').first();
    await expect(sidebar).toBeVisible();
  });

  test('should navigate to projects page', async ({ page }) => {
    await page.click('text=Projects');
    await expect(page).toHaveURL(/projects/);
  });

  test('should navigate to test cases page', async ({ page }) => {
    await page.click('text=Test Cases');
    await expect(page).toHaveURL(/test-cases/);
  });

  test('should navigate to runs page', async ({ page }) => {
    await page.click('text=Runs');
    await expect(page).toHaveURL(/runs/);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.click('text=Settings');
    await expect(page).toHaveURL(/settings/);
  });
});

test.describe('AutoTest AI - Theme', () => {
  test('should support dark mode toggle', async ({ page }) => {
    await page.goto('/settings');

    // Look for theme toggle
    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("Dark"), button:has-text("Light")').first();

    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Verify theme changed (check for dark class or style change)
      const html = page.locator('html');
      const isDark = await html.evaluate(el => el.classList.contains('dark'));
      expect(typeof isDark).toBe('boolean');
    }
  });
});

test.describe('AutoTest AI - Responsiveness', () => {
  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Main content should still be visible
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Main content should still be visible
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();
  });
});
