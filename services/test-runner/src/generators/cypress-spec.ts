import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { TestScenario, TestStep, GenerateSpecResponse } from '../types/index.js';
import { config } from '../config.js';

export async function generateCypressSpec(
  scenario: TestScenario,
  outputPath?: string
): Promise<GenerateSpecResponse> {
  const specContent = buildSpecContent(scenario);
  const fileName = `${sanitizeFileName(scenario.name)}.cy.ts`;
  const filePath = outputPath ?? join(config.cypress.specsDir, 'generated', fileName);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, specContent, 'utf-8');

  return {
    specContent,
    filePath,
  };
}

function buildSpecContent(scenario: TestScenario): string {
  const lines: string[] = [];

  lines.push(`describe('${escapeString(scenario.name)}', () => {`);

  if (scenario.description) {
    lines.push(`  // ${scenario.description}`);
  }

  lines.push('');

  if (scenario.timeout) {
    lines.push(`  const testTimeout = ${scenario.timeout};`);
    lines.push('');
  }

  lines.push(`  it('${escapeString(scenario.name)}', () => {`);

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
      return `${comment}cy.visit('${escapeString(step.value ?? '/')}');`;

    case 'click':
      // Use self-healing click command
      return `${comment}cy.selfHealingClick('${escapeString(step.selector ?? '')}');`;

    case 'type':
      // Use self-healing type command with clear first
      return `${comment}cy.selfHealingType('${escapeString(step.selector ?? '')}', '${escapeString(step.value ?? '')}');`;

    case 'clear':
      return `${comment}cy.selfHealingGet('${escapeString(step.selector ?? '')}').clear();`;

    case 'select':
      return `${comment}cy.selfHealingGet('${escapeString(step.selector ?? '')}').select('${escapeString(step.value ?? '')}');`;

    case 'check':
      return `${comment}cy.selfHealingGet('${escapeString(step.selector ?? '')}').check();`;

    case 'uncheck':
      return `${comment}cy.selfHealingGet('${escapeString(step.selector ?? '')}').uncheck();`;

    case 'hover':
      return `${comment}cy.selfHealingGet('${escapeString(step.selector ?? '')}').trigger('mouseover');`;

    case 'scroll':
      if (step.selector) {
        return `${comment}cy.selfHealingGet('${escapeString(step.selector)}').scrollIntoView();`;
      }
      return `${comment}cy.scrollTo('${escapeString(step.value ?? 'bottom')}');`;

    case 'wait':
      const waitTime = parseInt(step.value ?? '1000', 10);
      return `${comment}cy.wait(${waitTime});`;

    case 'screenshot':
      const screenshotName = step.value ?? `screenshot-${step.id}`;
      return `${comment}cy.screenshot('${escapeString(screenshotName)}');`;

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
  const selector = assertion.selector ? `cy.get('${escapeString(assertion.selector)}')` : 'cy';

  switch (assertion.type) {
    case 'visible':
      return `${selector}.should('be.visible');`;

    case 'hidden':
      return `${selector}.should('not.be.visible');`;

    case 'exists':
      return `${selector}.should('exist');`;

    case 'notExists':
      return `${selector}.should('not.exist');`;

    case 'text':
      return generateTextAssertion(selector, assertion);

    case 'value':
      return generateValueAssertion(selector, assertion);

    case 'attribute':
      return `${selector}.should('have.attr', '${escapeString(String(assertion.expected ?? ''))}');`;

    case 'url':
      return generateUrlAssertion(assertion);

    case 'title':
      return `cy.title().should('${assertion.operator ?? 'contain'}', '${escapeString(String(assertion.expected ?? ''))}');`;

    case 'count':
      return `${selector}.should('have.length', ${assertion.expected ?? 0});`;

    default:
      return `// Unknown assertion type: ${assertion.type}`;
  }
}

function generateTextAssertion(
  selector: string,
  assertion: { expected?: string | number | boolean; operator?: string }
): string {
  const expected = escapeString(String(assertion.expected ?? ''));

  switch (assertion.operator) {
    case 'equals':
      return `${selector}.should('have.text', '${expected}');`;
    case 'contains':
      return `${selector}.should('contain', '${expected}');`;
    case 'matches':
      return `${selector}.invoke('text').should('match', /${expected}/);`;
    default:
      return `${selector}.should('contain', '${expected}');`;
  }
}

function generateValueAssertion(
  selector: string,
  assertion: { expected?: string | number | boolean; operator?: string }
): string {
  const expected = escapeString(String(assertion.expected ?? ''));

  switch (assertion.operator) {
    case 'equals':
      return `${selector}.should('have.value', '${expected}');`;
    case 'contains':
      return `${selector}.invoke('val').should('contain', '${expected}');`;
    default:
      return `${selector}.should('have.value', '${expected}');`;
  }
}

function generateUrlAssertion(assertion: {
  expected?: string | number | boolean;
  operator?: string;
}): string {
  const expected = escapeString(String(assertion.expected ?? ''));

  switch (assertion.operator) {
    case 'equals':
      return `cy.url().should('eq', '${expected}');`;
    case 'contains':
      return `cy.url().should('include', '${expected}');`;
    case 'not.include':
      return `cy.url().should('not.include', '${expected}');`;
    case 'not.equals':
      return `cy.url().should('not.eq', '${expected}');`;
    case 'matches':
      return `cy.url().should('match', /${expected}/);`;
    default:
      return `cy.url().should('include', '${expected}');`;
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
