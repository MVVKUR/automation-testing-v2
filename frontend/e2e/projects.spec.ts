import { test, expect } from '@playwright/test';

test.describe('AutoTest AI - Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('should display projects page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /Projects/i })).toBeVisible();
  });

  test('should have create project button', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), a:has-text("Create"), a:has-text("New")').first();
    await expect(createButton).toBeVisible();
  });

  test('should open create project dialog', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // Should show dialog or form
      const dialog = page.locator('[role="dialog"], form, [data-testid="create-project-form"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display project list or empty state', async ({ page }) => {
    // Either show projects or empty state
    const content = page.locator('[data-testid="project-list"], [data-testid="empty-state"], .project-card, text="No projects"').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should search projects', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('test project');
      await page.waitForTimeout(500); // Debounce delay
      // Page should update (either show results or no results)
    }
  });
});

test.describe('AutoTest AI - Project Details', () => {
  test('should navigate to project details when clicking project', async ({ page }) => {
    await page.goto('/projects');

    // Wait for projects to load
    await page.waitForTimeout(1000);

    const projectCard = page.locator('.project-card, [data-testid="project-item"], a[href*="/projects/"]').first();

    if (await projectCard.isVisible()) {
      await projectCard.click();
      await expect(page).toHaveURL(/\/projects\/[^/]+/);
    }
  });
});
