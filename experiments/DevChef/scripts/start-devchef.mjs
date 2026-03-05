import { spawn, spawnSync } from 'node:child_process';

const DEFAULT_PORT = 39173;

function parsePortArg(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p') {
      return args[i + 1];
    }
    if (arg.startsWith('--port=')) {
      return arg.slice('--port='.length);
    }
  }
  return process.env.PORT;
}

function normalizePort(value) {
  const port = Number(value ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: "${value}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

function resolvePythonExecutable() {
  const candidates = process.env.PYTHON_EXE
    ? [process.env.PYTHON_EXE]
    : process.platform === 'win32'
      ? ['python', 'python3']
      : ['python3', 'python'];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    'Could not find a Python executable. Set PYTHON_EXE or install python/python3 in PATH.'
  );
}

function run() {
  const port = normalizePort(parsePortArg(process.argv.slice(2)));
  const pythonExe = resolvePythonExecutable();
  const child = spawn(pythonExe, ['-m', 'http.server', String(port)], {
    stdio: 'inherit',
  });

  console.log(`DevChef server listening on http://localhost:${port}`);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
