/// <reference types="cypress" />

// Self-healing configuration
const SELF_HEALING_CONFIG = {
  maxRetries: 3,
  retryDelay: 500,
  enableAiHealing: true,
  apiEndpoint: 'http://localhost:8082/api/heal-selector',
};

// Alternative selector patterns for common elements
const SELECTOR_PATTERNS: Record<string, string[]> = {
  email: [
    '#email',
    'input[type="email"]',
    'input[name="email"]',
    'input[id="email"]',
    '[data-testid="email"]',
    'input[placeholder*="email"]',
    'input[placeholder*="Email"]',
    'input[autocomplete="email"]',
  ],
  password: [
    '#password',
    'input[type="password"]',
    'input[name="password"]',
    'input[id="password"]',
    '[data-testid="password"]',
    'input[placeholder*="password"]',
    'input[placeholder*="Password"]',
  ],
  submit: [
    'button[type="submit"]',
    'form button[type="submit"]',
    'input[type="submit"]',
    'form button',
    '[data-testid="submit"]',
  ],
  username: [
    '#username',
    'input[name="username"]',
    'input[id="username"]',
    'input[type="text"][name*="user"]',
    '[data-testid="username"]',
  ],
};

/**
 * Detect element type from selector
 */
function detectElementType(selector: string): string | null {
  const lowerSelector = selector.toLowerCase();
  if (lowerSelector.includes('email')) return 'email';
  if (lowerSelector.includes('password')) return 'password';
  if (lowerSelector.includes('submit') || lowerSelector.includes('button')) return 'submit';
  if (lowerSelector.includes('username') || lowerSelector.includes('user')) return 'username';
  return null;
}

/**
 * Try to find element with alternative selectors
 */
function tryAlternativeSelectors(
  originalSelector: string,
  callback: (selector: string) => Cypress.Chainable<JQuery<HTMLElement>>
): Cypress.Chainable<JQuery<HTMLElement>> | null {
  const elementType = detectElementType(originalSelector);

  if (elementType && SELECTOR_PATTERNS[elementType]) {
    for (const altSelector of SELECTOR_PATTERNS[elementType]) {
      try {
        const element = Cypress.$(altSelector);
        if (element.length > 0) {
          cy.log(`🔧 Self-healing: Found element with "${altSelector}" instead of "${originalSelector}"`);
          return callback(altSelector);
        }
      } catch {
        // Continue to next selector
      }
    }
  }

  return null;
}

/**
 * Custom command: selfHealingGet
 * Attempts to find element with self-healing capability
 */
Cypress.Commands.add('selfHealingGet', (selector: string, options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>) => {
  const defaultOptions = { timeout: 10000, ...options };

  return cy.get('body').then(($body) => {
    // First, try the original selector
    const element = $body.find(selector);

    if (element.length > 0) {
      return cy.get(selector, defaultOptions);
    }

    // Element not found, try self-healing
    cy.log(`⚠️ Element not found: "${selector}". Attempting self-healing...`);

    const elementType = detectElementType(selector);

    if (elementType && SELECTOR_PATTERNS[elementType]) {
      for (const altSelector of SELECTOR_PATTERNS[elementType]) {
        const altElement = $body.find(altSelector);
        if (altElement.length > 0) {
          cy.log(`✅ Self-healing successful: Using "${altSelector}"`);
          return cy.get(altSelector, defaultOptions);
        }
      }
    }

    // Try generic patterns
    const genericPatterns = [
      `[id="${selector.replace('#', '')}"]`,
      `[name="${selector.replace('#', '')}"]`,
      `[data-testid="${selector.replace('#', '')}"]`,
    ];

    for (const pattern of genericPatterns) {
      const patternElement = $body.find(pattern);
      if (patternElement.length > 0) {
        cy.log(`✅ Self-healing successful: Using "${pattern}"`);
        return cy.get(pattern, defaultOptions);
      }
    }

    // If all else fails, return original (will fail with proper error)
    cy.log(`❌ Self-healing failed: Could not find alternative for "${selector}"`);
    return cy.get(selector, defaultOptions);
  });
});

/**
 * Custom command: selfHealingType
 * Types into element with self-healing capability and VERIFIES it worked
 */
Cypress.Commands.add('selfHealingType', (selector: string, text: string, options?: Partial<Cypress.TypeOptions>) => {
  return cy.selfHealingGet(selector).then(($el) => {
    // Clear existing value first
    cy.wrap($el).clear({ force: true });
    cy.wrap($el).type(text, { delay: 50, force: true, ...options });

    // VERIFY the value was actually typed
    cy.wrap($el).should('have.value', text).then(($verifiedEl) => {
      const actualValue = ($verifiedEl as JQuery<HTMLInputElement>).val();
      if (actualValue !== text) {
        throw new Error(`Self-healing verification failed: Expected "${text}" but got "${actualValue}"`);
      }
      cy.log(`✅ Verified: Value "${text}" was successfully typed`);
    });
  });
});

/**
 * Custom command: selfHealingClick
 * Clicks element with self-healing capability
 */
Cypress.Commands.add('selfHealingClick', (selector: string, options?: Partial<Cypress.ClickOptions>) => {
  return cy.selfHealingGet(selector).then(($el) => {
    cy.wrap($el).click(options);
  });
});

// Extend Cypress types
declare global {
  namespace Cypress {
    interface Chainable {
      selfHealingGet(selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
      selfHealingType(selector: string, text: string, options?: Partial<TypeOptions>): Chainable<void>;
      selfHealingClick(selector: string, options?: Partial<ClickOptions>): Chainable<void>;
    }
  }
}

export {};
