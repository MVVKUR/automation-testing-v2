// Cypress E2E support file

// Import commands
import './commands';
import './self-healing';

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Log the error but don't fail the test
  console.error('Uncaught exception:', err.message);
  // Return false to prevent Cypress from failing the test
  return false;
});

// Before each test
beforeEach(() => {
  // Clear cookies and local storage
  cy.clearCookies();
  cy.clearLocalStorage();
});

// After each test
afterEach(function () {
  // Take screenshot on failure
  if (this.currentTest?.state === 'failed') {
    const testName = this.currentTest.title.replace(/\s+/g, '-');
    cy.screenshot(`failure-${testName}`, { capture: 'fullPage' });
  }
});
