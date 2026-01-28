const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow = null;
let pythonProcess = null;

// Detect dev mode: check if running from source (not packaged)
const isDev = !app.isPackaged;
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

/**
 * Wait for the backend server to be ready
 */
function waitForBackend(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.get(`${BACKEND_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Backend health check failed'));
        }
      });

      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Backend not responding'));
        }
      });

      req.end();
    };

    check();
  });
}

/**
 * Find Python executable - prefers conda 'autotest' env
 */
function findPython() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;

  // Check for conda 'autotest' environment first, then other Python locations
  const condaEnvPaths = [
    // macOS/Linux conda paths
    path.join(homeDir, 'anaconda3', 'envs', 'autotest', 'bin', 'python'),
    path.join(homeDir, 'miniconda3', 'envs', 'autotest', 'bin', 'python'),
    path.join(homeDir, 'opt', 'anaconda3', 'envs', 'autotest', 'bin', 'python'),
    path.join('/opt', 'anaconda3', 'envs', 'autotest', 'bin', 'python'),
    // Windows conda paths
    path.join(homeDir, 'anaconda3', 'envs', 'autotest', 'python.exe'),
    path.join(homeDir, 'miniconda3', 'envs', 'autotest', 'python.exe'),
    // Also check base conda
    path.join(homeDir, 'anaconda3', 'bin', 'python'),
    path.join(homeDir, 'opt', 'anaconda3', 'bin', 'python'),
    path.join('/opt', 'anaconda3', 'bin', 'python'),
    // macOS Framework Python (Homebrew/official installer)
    '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3',
    '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3',
    '/usr/local/bin/python3',
  ];

  for (const condaPath of condaEnvPaths) {
    if (fs.existsSync(condaPath)) {
      console.log(`Found conda Python: ${condaPath}`);
      return condaPath;
    }
  }

  // Fallback to system Python
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      const result = execSync(`which ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      if (result.trim()) {
        return result.trim();
      }
    } catch (e) {
      // Continue to next candidate
    }
  }

  // Fallback to just 'python3' and hope it's in PATH
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Start the Python backend server
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = isDev
      ? path.join(__dirname, '..', '..', 'backend')
      : path.join(process.resourcesPath, 'backend');

    // Check if we're running from a packaged app with bundled Python
    const bundledPython = path.join(
      process.resourcesPath,
      'python',
      process.platform === 'win32' ? 'python.exe' : 'bin/python3'
    );

    const pythonPath = fs.existsSync(bundledPython)
      ? bundledPython
      : findPython();

    console.log(`Dev mode: ${isDev}`);
    console.log(`Starting backend from: ${backendPath}`);
    console.log(`Using Python: ${pythonPath}`);

    pythonProcess = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
      cwd: backendPath,
      shell: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PATH: process.env.PATH,
      },
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      reject(err);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      pythonProcess = null;
    });

    // Wait for backend to be ready
    waitForBackend()
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Stop the Python backend server
 */
function stopBackend() {
  if (pythonProcess) {
    console.log('Stopping backend...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
    } else {
      pythonProcess.kill('SIGTERM');
    }
    pythonProcess = null;
  }
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-app-info', () => {
  return {
    name: 'AutoTest AI',
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  };
});

ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});

ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url);
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend first
    console.log('Starting backend server...');
    await startBackend();
    console.log('Backend server is ready');

    // Create window
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('quit', () => {
  stopBackend();
});
