// Custom Cypress commands

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      waitForApi(alias: string, timeout?: number): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      getByRole(role: string, options?: { name?: string | RegExp }): Chainable<JQuery<HTMLElement>>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('not.include', '/login');
  });
});

// Wait for API response
Cypress.Commands.add('waitForApi', (alias: string, timeout = 10000) => {
  cy.wait(`@${alias}`, { timeout });
});

// Get element by data-testid
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

// Get element by role
Cypress.Commands.add('getByRole', (role: string, options?: { name?: string | RegExp }) => {
  if (options?.name) {
    return cy.get(`[role="${role}"]`).filter((_, el) => {
      const text = el.textContent || el.getAttribute('aria-label') || '';
      if (typeof options.name === 'string') {
        return text.includes(options.name);
      }
      return options.name.test(text);
    });
  }
  return cy.get(`[role="${role}"]`);
});

export {};
