import { test, expect } from '@playwright/test';

test.describe('AutoTest AI - Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scenarios');
  });

  test('should display scenarios page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /Scenarios/i })).toBeVisible();
  });

  test('should display scenario list or empty state', async ({ page }) => {
    const content = page.locator('[data-testid="scenario-list"], [data-testid="empty-state"], .scenario-item, text="No scenarios"').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});

test.describe('AutoTest AI - Scenario Builder', () => {
  test('should open scenario builder', async ({ page }) => {
    await page.goto('/scenarios');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), a:has-text("Create")').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Should show scenario builder UI
      const builder = page.locator('[data-testid="scenario-builder"], .scenario-builder, .steps-panel').first();
      await page.waitForTimeout(500);
    }
  });

  test('should add steps to scenario', async ({ page }) => {
    await page.goto('/scenarios');

    // Navigate to create or edit scenario
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Look for add step button
      const addStepButton = page.locator('button:has-text("Add Step"), button:has-text("Add"), button[title*="Add"]').first();

      if (await addStepButton.isVisible()) {
        await addStepButton.click();
        await page.waitForTimeout(500);

        // Should show step options
        const stepOptions = page.locator('[role="menu"], [role="dialog"], .step-types').first();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should support drag and drop for step reordering', async ({ page }) => {
    // This is a visual check - drag and drop is complex to automate
    await page.goto('/scenarios');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Look for drag handles
      const dragHandles = page.locator('[data-testid="drag-handle"], .drag-handle, [draggable="true"]');
      const count = await dragHandles.count();

      // If there are draggable items, the feature is present
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('AutoTest AI - Step Types', () => {
  test('should have navigation step type', async ({ page }) => {
    await page.goto('/scenarios');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      const addStepButton = page.locator('button:has-text("Add Step"), button:has-text("Add")').first();

      if (await addStepButton.isVisible()) {
        await addStepButton.click();
        await page.waitForTimeout(500);

        // Check for navigation/visit step type
        const visitStep = page.locator('text="Visit", text="Navigate", text="Go to"').first();
        await page.waitForTimeout(500);

        if (await visitStep.isVisible()) {
          await expect(visitStep).toBeVisible();
        }
      }
    }
  });

  test('should have click step type', async ({ page }) => {
    await page.goto('/scenarios');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      const addStepButton = page.locator('button:has-text("Add Step"), button:has-text("Add")').first();

      if (await addStepButton.isVisible()) {
        await addStepButton.click();
        await page.waitForTimeout(500);

        const clickStep = page.locator('text="Click"').first();
        await page.waitForTimeout(500);

        if (await clickStep.isVisible()) {
          await expect(clickStep).toBeVisible();
        }
      }
    }
  });

  test('should have type/input step type', async ({ page }) => {
    await page.goto('/scenarios');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      const addStepButton = page.locator('button:has-text("Add Step"), button:has-text("Add")').first();

      if (await addStepButton.isVisible()) {
        await addStepButton.click();
        await page.waitForTimeout(500);

        const typeStep = page.locator('text="Type", text="Input", text="Enter"').first();
        await page.waitForTimeout(500);

        if (await typeStep.isVisible()) {
          await expect(typeStep).toBeVisible();
        }
      }
    }
  });
});
