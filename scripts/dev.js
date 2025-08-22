#!/usr/bin/env node
/* eslint-env node */
/* Simple dev launcher that ensures only one Vite server on the target port.
 * ESM version.
 */
import { spawnSync, spawn } from 'node:child_process';
import readline from 'node:readline';

const PORT = process.env.PORT || 5173;

function isPortInUse(port) {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    const res = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    if (res.status !== 0) return [];
    return res.stdout.split('\n').filter(Boolean).slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return { command: parts[0], pid: parts[1] };
    });
  }
  // windows fallback (netstat parsing minimalistic)
  if (process.platform === 'win32') {
    const res = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
    if (res.status !== 0) return [];
    return res.stdout.split('\n').filter(l => l.includes(`:${port}`) && l.includes('LISTEN')).map(line => {
      const parts = line.trim().split(/\s+/);
      return { command: 'pid', pid: parts[parts.length - 1] };
    });
  }
  return [];
}

function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

(async () => {
  const users = isPortInUse(PORT);
  if (users.length) {
    console.log(`Port ${PORT} is currently in use by:`);
    users.forEach(u => console.log(`  PID ${u.pid} - ${u.command}`));
    const ans = await prompt('Kill these processes and restart dev server? (y/N): ');
    if (!/^y(es)?$/i.test(ans)) {
      console.log('Aborting dev start.');
      process.exit(1);
    }
    for (const u of users) {
      try {
        process.kill(Number(u.pid), 'SIGKILL');
        console.log(`Killed PID ${u.pid}`);
      } catch (e) {
        console.warn(`Failed to kill PID ${u.pid}:`, e.message);
      }
    }
  }
  // Start vite with strictPort so it errors if something else grabs it after
  console.log(`Starting Vite on port ${PORT}...`);
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'inherit', env: process.env });
  vite.on('exit', code => {
    if (code !== 0) {
      console.error(`Vite exited with code ${code}`);
    }
  });
})();
