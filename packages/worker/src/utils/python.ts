import { spawn } from 'child_process';
import { platform } from 'os';

const REQUIRED_PYTHON_VERSION = '3.10';
const MINICONDA_URL = 'https://docs.conda.io/en/latest/miniconda.html';

interface PythonCheckResult {
  valid: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

/**
 * Get the Python executable path based on environment and platform
 */
export function getPythonPath(): string {
  // Check for explicit override first
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }

  // Default paths based on platform
  const isWindows = platform() === 'win32';

  // Check for conda environment
  if (process.env.CONDA_PREFIX) {
    return isWindows
      ? `${process.env.CONDA_PREFIX}\\python.exe`
      : `${process.env.CONDA_PREFIX}/bin/python`;
  }

  // Check for local venv
  if (isWindows) {
    return '.venv\\Scripts\\python.exe';
  }
  return '.venv/bin/python';
}

/**
 * Check if Python is available and meets version requirements
 */
export async function checkPython(): Promise<PythonCheckResult> {
  const pythonPath = getPythonPath();

  return new Promise((resolve) => {
    const proc = spawn(pythonPath, ['--version'], {
      stdio: 'pipe',
      shell: platform() === 'win32',
    });

    let output = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('error', () => {
      resolve({
        valid: false,
        version: null,
        path: pythonPath,
        error: `Python not found at: ${pythonPath}`,
      });
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({
          valid: false,
          version: null,
          path: pythonPath,
          error: `Python not found at: ${pythonPath}`,
        });
        return;
      }

      // Parse version from output like "Python 3.10.12"
      const match = output.match(/Python (\d+\.\d+)/);
      if (!match) {
        resolve({
          valid: false,
          version: null,
          path: pythonPath,
          error: `Could not parse Python version from: ${output}`,
        });
        return;
      }

      const version = match[1];
      const [major, minor] = version.split('.').map(Number);
      const [reqMajor, reqMinor] = REQUIRED_PYTHON_VERSION.split('.').map(Number);

      const valid = major > reqMajor || (major === reqMajor && minor >= reqMinor);

      resolve({
        valid,
        version,
        path: pythonPath,
        error: valid ? null : `Python ${version} found, but ${REQUIRED_PYTHON_VERSION}+ required`,
      });
    });
  });
}

/**
 * Check Python and print helpful error message if invalid
 * Returns the Python path if valid, throws if not
 */
export async function requirePython(): Promise<string> {
  const result = await checkPython();

  if (result.valid && result.path) {
    console.log(`[Python] Using Python ${result.version} at: ${result.path}`);
    return result.path;
  }

  // Print helpful error message
  const isWindows = platform() === 'win32';

  console.error('\n' + '='.repeat(60));
  console.error('PYTHON ENVIRONMENT ERROR');
  console.error('='.repeat(60));

  if (result.error) {
    console.error(`\nError: ${result.error}`);
  }

  console.error(`\nThis project requires Python ${REQUIRED_PYTHON_VERSION} or higher.`);
  console.error('\nRecommended setup using Miniconda:');
  console.error('─'.repeat(40));

  if (isWindows) {
    console.error(`
1. Download Miniconda from: ${MINICONDA_URL}
   (Choose "Miniconda3 Windows 64-bit")

2. Install Miniconda (check "Add to PATH" option)

3. Open a new terminal and run:
   conda create -n viona python=${REQUIRED_PYTHON_VERSION}
   conda activate viona

4. Install dependencies:
   pip install claude-agent-sdk anthropic

5. Set PYTHON_PATH in your .env file:
   PYTHON_PATH=C:\\Users\\<you>\\miniconda3\\envs\\viona\\python.exe
`);
  } else {
    console.error(`
1. Download Miniconda from: ${MINICONDA_URL}
   (Choose your OS version)

2. Install Miniconda:
   bash Miniconda3-latest-*.sh

3. Create environment:
   conda create -n viona python=${REQUIRED_PYTHON_VERSION}
   conda activate viona

4. Install dependencies:
   pip install claude-agent-sdk anthropic

5. Set PYTHON_PATH in your .env file:
   PYTHON_PATH=$HOME/miniconda3/envs/viona/bin/python
`);
  }

  console.error('='.repeat(60) + '\n');

  throw new Error(`Python ${REQUIRED_PYTHON_VERSION}+ is required but not found. See instructions above.`);
}

/**
 * Check if we're running in production (Docker/Railway)
 * In prod, Python should be available at /opt/venv/bin/python
 */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
}

/**
 * Get production Python path
 */
export function getProductionPythonPath(): string {
  return '/opt/venv/bin/python';
}
