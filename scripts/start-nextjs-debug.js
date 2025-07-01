const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Next.js with debugging...\n');

const webDir = path.join(__dirname, '..', 'apps', 'web');
process.chdir(webDir);

console.log('📁 Working directory:', process.cwd());
console.log('🔍 Environment:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('\n');

const next = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', '3000'], {
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit'
});

next.on('error', (err) => {
  console.error('❌ Failed to start Next.js:', err);
  process.exit(1);
});

next.on('exit', (code) => {
  console.log(`Next.js exited with code ${code}`);
  process.exit(code);
});