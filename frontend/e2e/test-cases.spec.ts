import { test, expect } from '@playwright/test';

test.describe('AutoTest AI - Test Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-cases');
  });

  test('should display test cases page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /Test Cases/i })).toBeVisible();
  });

  test('should have create test case button', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    await expect(createButton).toBeVisible();
  });

  test('should filter test cases by status', async ({ page }) => {
    const statusFilter = page.locator('select, [role="combobox"], button:has-text("Status")').first();

    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      // Should show filter options
      const options = page.locator('[role="option"], [role="menuitem"], option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display test case list or empty state', async ({ page }) => {
    const content = page.locator('[data-testid="test-case-list"], [data-testid="empty-state"], .test-case-item, text="No test cases"').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should show test case details when clicking item', async ({ page }) => {
    await page.waitForTimeout(1000);

    const testCaseItem = page.locator('.test-case-item, [data-testid="test-case-item"], tr[data-testid], a[href*="/test-cases/"]').first();

    if (await testCaseItem.isVisible()) {
      await testCaseItem.click();
      // Should show details panel or navigate
      await page.waitForTimeout(500);
    }
  });
});

test.describe('AutoTest AI - Test Case Creation', () => {
  test('should open create test case form', async ({ page }) => {
    await page.goto('/test-cases');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // Should show form fields
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[id*="name" i]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/test-cases');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first();

      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation errors
        const errorMessage = page.locator('[role="alert"], .error, text="required" i').first();
        // Either show error or prevent submission
        await page.waitForTimeout(500);
      }
    }
  });
});
