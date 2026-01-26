import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { TestScenario, TestStep, GenerateSpecResponse } from '../types/index.js';
import { config } from '../config.js';

export async function generatePlaywrightSpec(
  scenario: TestScenario,
  outputPath?: string
): Promise<GenerateSpecResponse> {
  const specContent = buildSpecContent(scenario);
  const fileName = `${sanitizeFileName(scenario.name)}.spec.ts`;
  const filePath = outputPath ?? join(config.playwright.specsDir, 'generated', fileName);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, specContent, 'utf-8');

  return {
    specContent,
    filePath,
  };
}

function buildSpecContent(scenario: TestScenario): string {
  const lines: string[] = [];

  // Import Playwright test
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');

  // Test configuration
  if (scenario.timeout) {
    lines.push(`test.setTimeout(${scenario.timeout});`);
    lines.push('');
  }

  // Test description
  lines.push(`test.describe('${escapeString(scenario.name)}', () => {`);

  if (scenario.description) {
    lines.push(`  // ${scenario.description}`);
  }

  lines.push('');

  // Main test
  lines.push(`  test('${escapeString(scenario.name)}', async ({ page }) => {`);

  for (const step of scenario.steps) {
    const stepCode = generateStepCode(step);
    lines.push(`    ${stepCode}`);

    if (step.assertions) {
      for (const assertion of step.assertions) {
        const assertionCode = generateAssertionCode(assertion);
        lines.push(`    ${assertionCode}`);
      }
    }
  }

  lines.push('  });');
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function generateStepCode(step: TestStep): string {
  const comment = step.description ? `// ${step.description}\n    ` : '';

  switch (step.action) {
    case 'visit':
      return `${comment}await page.goto('${escapeString(step.value ?? '/')}');`;

    case 'click':
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').click();`;

    case 'type':
      // Playwright uses fill() for typing
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').fill('${escapeString(step.value ?? '')}');`;

    case 'clear':
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').clear();`;

    case 'select':
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').selectOption('${escapeString(step.value ?? '')}');`;

    case 'check':
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').check();`;

    case 'uncheck':
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').uncheck();`;

    case 'hover':
      return `${comment}await page.locator('${escapeString(step.selector ?? '')}').hover();`;

    case 'scroll':
      if (step.selector) {
        return `${comment}await page.locator('${escapeString(step.selector)}').scrollIntoViewIfNeeded();`;
      }
      // Scroll to bottom of page
      return `${comment}await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`;

    case 'wait':
      const waitTime = parseInt(step.value ?? '1000', 10);
      return `${comment}await page.waitForTimeout(${waitTime});`;

    case 'screenshot':
      const screenshotName = step.value ?? `screenshot-${step.id}`;
      return `${comment}await page.screenshot({ path: '${escapeString(screenshotName)}.png' });`;

    case 'assert':
      return generateInlineAssertion(step);

    case 'custom':
      return `${comment}// Custom step: ${escapeString(step.value ?? '')}`;

    default:
      return `// Unknown action: ${step.action}`;
  }
}

function generateInlineAssertion(step: TestStep): string {
  if (!step.assertions || step.assertions.length === 0) {
    return `// No assertion defined for step ${step.id}`;
  }

  return step.assertions.map((a) => generateAssertionCode(a)).join('\n    ');
}

function generateAssertionCode(assertion: {
  type: string;
  selector?: string;
  expected?: string | number | boolean;
  operator?: string;
}): string {
  const locator = assertion.selector
    ? `page.locator('${escapeString(assertion.selector)}')`
    : 'page';

  switch (assertion.type) {
    case 'visible':
      return `await expect(${locator}).toBeVisible();`;

    case 'hidden':
      return `await expect(${locator}).toBeHidden();`;

    case 'exists':
      return `await expect(${locator}).toHaveCount(1);`;

    case 'notExists':
      return `await expect(${locator}).toHaveCount(0);`;

    case 'text':
      return generateTextAssertion(locator, assertion);

    case 'value':
      return generateValueAssertion(locator, assertion);

    case 'attribute':
      // For attribute assertions, we need the attribute name and expected value
      // Assuming format: "attributeName=expectedValue"
      const attrParts = String(assertion.expected ?? '').split('=');
      if (attrParts.length === 2) {
        return `await expect(${locator}).toHaveAttribute('${escapeString(attrParts[0])}', '${escapeString(attrParts[1])}');`;
      }
      return `await expect(${locator}).toHaveAttribute('${escapeString(String(assertion.expected ?? ''))}');`;

    case 'url':
      return generateUrlAssertion(assertion);

    case 'title':
      return `await expect(page).toHaveTitle(/${escapeRegex(String(assertion.expected ?? ''))}/);`;

    case 'count':
      return `await expect(${locator}).toHaveCount(${assertion.expected ?? 0});`;

    default:
      return `// Unknown assertion type: ${assertion.type}`;
  }
}

function generateTextAssertion(
  locator: string,
  assertion: { expected?: string | number | boolean; operator?: string }
): string {
  const expected = String(assertion.expected ?? '');

  switch (assertion.operator) {
    case 'equals':
      return `await expect(${locator}).toHaveText('${escapeString(expected)}');`;
    case 'contains':
      return `await expect(${locator}).toContainText('${escapeString(expected)}');`;
    case 'matches':
      return `await expect(${locator}).toHaveText(/${escapeRegex(expected)}/);`;
    default:
      return `await expect(${locator}).toContainText('${escapeString(expected)}');`;
  }
}

function generateValueAssertion(
  locator: string,
  assertion: { expected?: string | number | boolean; operator?: string }
): string {
  const expected = String(assertion.expected ?? '');

  switch (assertion.operator) {
    case 'equals':
      return `await expect(${locator}).toHaveValue('${escapeString(expected)}');`;
    case 'contains':
      return `await expect(${locator}).toHaveValue(/${escapeRegex(expected)}/);`;
    default:
      return `await expect(${locator}).toHaveValue('${escapeString(expected)}');`;
  }
}

function generateUrlAssertion(assertion: {
  expected?: string | number | boolean;
  operator?: string;
}): string {
  const expected = String(assertion.expected ?? '');

  switch (assertion.operator) {
    case 'equals':
      return `await expect(page).toHaveURL('${escapeString(expected)}');`;
    case 'contains':
      return `await expect(page).toHaveURL(/${escapeRegex(expected)}/);`;
    case 'not.include':
      return `await expect(page).not.toHaveURL(/${escapeRegex(expected)}/);`;
    case 'not.equals':
      return `await expect(page).not.toHaveURL('${escapeString(expected)}');`;
    case 'matches':
      return `await expect(page).toHaveURL(/${escapeRegex(expected)}/);`;
    default:
      return `await expect(page).toHaveURL(/${escapeRegex(expected)}/);`;
  }
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateSpecFromTemplate(
  scenario: TestScenario,
  template: string
): string {
  let spec = template;

  spec = spec.replace(/\{\{name\}\}/g, scenario.name);
  spec = spec.replace(/\{\{description\}\}/g, scenario.description ?? '');
  spec = spec.replace(/\{\{id\}\}/g, scenario.id);

  const stepsCode = scenario.steps.map((step) => generateStepCode(step)).join('\n');
  spec = spec.replace(/\{\{steps\}\}/g, stepsCode);

  return spec;
}
