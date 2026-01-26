import { NextRequest, NextResponse } from 'next/server';

// Store running processes (in production, use a proper process manager)
const runningApps: Map<string, { port: number; pid?: number }> = new Map();

// Find an available port
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  // For demo, return a random port between 3000-3100
  return startPort + Math.floor(Math.random() * 100);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, repoUrl, branch } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Check if already running
    if (runningApps.has(projectId)) {
      const app = runningApps.get(projectId)!;
      return NextResponse.json({
        status: 'running',
        port: app.port,
        url: `http://localhost:${app.port}`,
      });
    }

    // Find available port
    const port = await findAvailablePort(3000);

    // In a real implementation, we would:
    // 1. Find the cloned project directory
    // 2. Run npm install (if not already done)
    // 3. Run npm run dev with the specified port
    // 4. Track the child process

    // For demo, we simulate starting the app
    runningApps.set(projectId, { port });

    // Simulate startup delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return NextResponse.json({
      status: 'started',
      port,
      url: `http://localhost:${port}`,
      message: `App started on port ${port}`,
    });
  } catch (error) {
    console.error('Error starting app:', error);
    return NextResponse.json(
      { error: 'Failed to start app' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Stop the running app
    if (runningApps.has(projectId)) {
      // In a real implementation, we would kill the child process
      runningApps.delete(projectId);
    }

    return NextResponse.json({
      status: 'stopped',
      message: 'App stopped successfully',
    });
  } catch (error) {
    console.error('Error stopping app:', error);
    return NextResponse.json(
      { error: 'Failed to stop app' },
      { status: 500 }
    );
  }
}
