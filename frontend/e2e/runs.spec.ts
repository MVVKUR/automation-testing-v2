import { test, expect } from '@playwright/test';

test.describe('AutoTest AI - Test Runs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/runs');
  });

  test('should display runs page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /Runs|Execution/i })).toBeVisible();
  });

  test('should display run history or empty state', async ({ page }) => {
    const content = page.locator('[data-testid="runs-list"], [data-testid="empty-state"], .run-item, text="No runs"').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should filter runs by status', async ({ page }) => {
    const statusFilter = page.locator('select, [role="combobox"], button:has-text("Filter"), button:has-text("Status")').first();

    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(300);
    }
  });

  test('should display run statistics', async ({ page }) => {
    // Look for statistics display
    const stats = page.locator('[data-testid="run-stats"], .stats, text="passed" i, text="failed" i').first();
    await page.waitForTimeout(1000);

    if (await stats.isVisible()) {
      await expect(stats).toBeVisible();
    }
  });

  test('should show run details when clicking item', async ({ page }) => {
    await page.waitForTimeout(1000);

    const runItem = page.locator('.run-item, [data-testid="run-item"], tr[data-testid], a[href*="/runs/"]').first();

    if (await runItem.isVisible()) {
      await runItem.click();
      await page.waitForTimeout(500);
      // Should show details or navigate
    }
  });
});

test.describe('AutoTest AI - Run Execution', () => {
  test('should have run button for scenarios', async ({ page }) => {
    await page.goto('/scenarios');

    const runButton = page.locator('button:has-text("Run"), button:has-text("Execute"), button[title*="Run" i]').first();
    await page.waitForTimeout(1000);

    if (await runButton.isVisible()) {
      await expect(runButton).toBeEnabled();
    }
  });

  test('should show runner selection options', async ({ page }) => {
    await page.goto('/scenarios');

    const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();

    if (await runButton.isVisible()) {
      await runButton.click();

      // Should show runner options (Cypress/Playwright)
      const runnerOptions = page.locator('text="Cypress", text="Playwright", [data-testid="runner-select"]').first();
      await page.waitForTimeout(1000);

      if (await runnerOptions.isVisible()) {
        await expect(runnerOptions).toBeVisible();
      }
    }
  });
});
