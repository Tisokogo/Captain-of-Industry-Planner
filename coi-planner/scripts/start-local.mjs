#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const bridge = spawn(process.execPath, ['scripts/data-bridge.mjs'], { stdio: 'inherit' });
const vite = spawn(npmCommand, ['run', 'dev', '--', '--open'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

function stop(code = 0) {
  bridge.kill();
  vite.kill();
  process.exit(code);
}

bridge.on('error', () => stop(1));
vite.on('error', () => stop(1));
vite.on('exit', (code, signal) => stop(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
