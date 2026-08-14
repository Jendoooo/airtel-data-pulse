// Sync local usage only. This intentionally never commits or pushes data.
// Usage: node scripts/sync-and-push.js

const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const port = Number(process.env.PORT || 3456);

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 503) return;
    } catch (error) {
      // The child process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local dashboard did not start in time');
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: { ...process.env, BIND_HOST: '127.0.0.1' },
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    const response = await fetch(`http://127.0.0.1:${port}/api/sync`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Local sync failed');
    console.log(`\nLocal sync complete: ${result.totalEntries} entries saved.`);
    console.log('No git commit or push was performed.\n');
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(`\nSync failed: ${error.message}\n`);
  process.exitCode = 1;
});
