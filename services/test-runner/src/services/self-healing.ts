import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface SelectorSuggestion {
  selector: string;
  confidence: number;
  reason: string;
}

export interface HealingResult {
  success: boolean;
  originalSelector: string;
  newSelector?: string;
  suggestions: SelectorSuggestion[];
  error?: string;
}

/**
 * Analyzes the page HTML and finds the correct selector for an element
 */
export async function healSelector(
  pageHtml: string,
  originalSelector: string,
  action: string,
  targetDescription: string
): Promise<HealingResult> {
  try {
    const prompt = `You are a test automation expert. A Cypress test failed because the selector "${originalSelector}" could not find the element.

Action being performed: ${action}
Element description: ${targetDescription}

Here is the current page HTML:
\`\`\`html
${pageHtml.substring(0, 15000)}
\`\`\`

Analyze the HTML and find the correct CSS selector for this element. Consider:
1. ID selectors (#id)
2. Name attributes ([name="..."])
3. Data attributes ([data-testid="..."])
4. Class combinations (.class1.class2)
5. Semantic selectors (form input[type="email"])

Return a JSON object with this exact format:
{
  "suggestions": [
    {
      "selector": "the CSS selector",
      "confidence": 0.95,
      "reason": "why this selector should work"
    }
  ]
}

Provide up to 3 suggestions ordered by confidence (highest first).`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const suggestions: SelectorSuggestion[] = result.suggestions || [];

    return {
      success: suggestions.length > 0,
      originalSelector,
      newSelector: suggestions[0]?.selector,
      suggestions,
    };
  } catch (error) {
    console.error('Self-healing error:', error);
    return {
      success: false,
      originalSelector,
      suggestions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generates alternative selectors based on common patterns
 */
export function generateAlternativeSelectors(originalSelector: string): string[] {
  const alternatives: string[] = [];

  // If it's an ID selector, try other patterns
  if (originalSelector.startsWith('#')) {
    const id = originalSelector.slice(1);
    alternatives.push(`[id="${id}"]`);
    alternatives.push(`[name="${id}"]`);
    alternatives.push(`input#${id}`);
    alternatives.push(`[data-testid="${id}"]`);
  }

  // If it's looking for email input
  if (originalSelector.includes('email')) {
    alternatives.push('input[type="email"]');
    alternatives.push('input[name="email"]');
    alternatives.push('input[placeholder*="email"]');
    alternatives.push('input[placeholder*="Email"]');
    alternatives.push('[data-testid*="email"]');
  }

  // If it's looking for password input
  if (originalSelector.includes('password')) {
    alternatives.push('input[type="password"]');
    alternatives.push('input[name="password"]');
    alternatives.push('input[placeholder*="password"]');
    alternatives.push('input[placeholder*="Password"]');
    alternatives.push('[data-testid*="password"]');
  }

  // If it's looking for submit button
  if (originalSelector.includes('submit') || originalSelector.includes('button')) {
    alternatives.push('button[type="submit"]');
    alternatives.push('input[type="submit"]');
    alternatives.push('form button');
    alternatives.push('button:contains("Sign")');
    alternatives.push('button:contains("Login")');
    alternatives.push('button:contains("Log in")');
  }

  return alternatives;
}

/**
 * Validates if a selector might work based on common patterns
 */
export function validateSelector(selector: string): boolean {
  // Basic validation - check if it's a valid CSS selector pattern
  try {
    // Simple regex check for common selector patterns
    const validPatterns = [
      /^#[\w-]+$/,                    // ID selector
      /^\[[\w-]+="[^"]*"\]$/,         // Attribute selector
      /^\.[\w-]+$/,                   // Class selector
      /^[\w]+$/,                      // Element selector
      /^[\w]+\[[\w-]+="[^"]*"\]$/,   // Element with attribute
      /^[\w]+#[\w-]+$/,              // Element with ID
      /^[\w]+\.[\w-]+$/,             // Element with class
    ];

    return validPatterns.some(pattern => pattern.test(selector)) || selector.includes(' ');
  } catch {
    return false;
  }
}
