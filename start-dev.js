import { spawn } from 'child_process';

console.log('Starting backend Express server and Vite frontend concurrently...');

// Start Express server on port 3000
const backend = spawn('node', ['api/index.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000' }
});

// Start Vite dev server
const frontend = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true
});

backend.on('close', (code) => {
  console.log(`Backend server exited with code ${code}`);
  frontend.kill();
  process.exit(code || 0);
});

frontend.on('close', (code) => {
  console.log(`Vite frontend exited with code ${code}`);
  backend.kill();
  process.exit(code || 0);
});
