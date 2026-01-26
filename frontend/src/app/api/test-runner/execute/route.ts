import { NextRequest, NextResponse } from 'next/server';

// Test step interface
interface TestStep {
  id: string;
  type: 'navigate' | 'type' | 'click' | 'verify' | 'wait';
  label: string;
  config: {
    url?: string;
    selector?: string;
    value?: string;
    timeout?: number;
    expected?: string;
  };
}

interface ExecuteRequest {
  steps: TestStep[];
  baseUrl: string;
}

interface StepResult {
  stepId: string;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
  screenshot?: string;
}

// Simulate test execution - in production this would use Puppeteer/Playwright
async function executeSteps(steps: TestStep[], baseUrl: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const step of steps) {
    const startTime = Date.now();

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    let status: 'passed' | 'failed' = 'passed';
    let error: string | undefined;

    // Simulate different step behaviors
    switch (step.type) {
      case 'navigate':
        // Navigation usually passes
        if (!step.config.url) {
          status = 'failed';
          error = 'URL is required for navigate step';
        }
        break;

      case 'type':
        // Type action - check for required fields
        if (!step.config.selector || !step.config.value) {
          status = 'failed';
          error = 'Selector and value are required for type step';
        }
        break;

      case 'click':
        // Click action
        if (!step.config.selector) {
          status = 'failed';
          error = 'Selector is required for click step';
        }
        break;

      case 'wait':
        // Wait always passes
        await new Promise(resolve => setTimeout(resolve, step.config.timeout || 1000));
        break;

      case 'verify':
        // Verify action
        if (!step.config.selector || !step.config.expected) {
          status = 'failed';
          error = 'Selector and expected value are required for verify step';
        }
        break;
    }

    const duration = Date.now() - startTime;

    results.push({
      stepId: step.id,
      status,
      duration,
      error,
    });

    // Stop on failure
    if (status === 'failed') {
      break;
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();
    const { steps, baseUrl } = body;

    if (!steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Invalid request: steps array required' },
        { status: 400 }
      );
    }

    console.log(`Executing ${steps.length} test steps for ${baseUrl}`);

    const results = await executeSteps(steps, baseUrl);

    const allPassed = results.every(r => r.status === 'passed');
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return NextResponse.json({
      success: true,
      status: allPassed ? 'passed' : 'failed',
      totalDuration,
      results,
    });
  } catch (error) {
    console.error('Test execution error:', error);
    return NextResponse.json(
      { error: 'Test execution failed', details: String(error) },
      { status: 500 }
    );
  }
}
