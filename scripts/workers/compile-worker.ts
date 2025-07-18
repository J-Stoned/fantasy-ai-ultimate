#!/usr/bin/env tsx
/**
 * Compile TypeScript worker to JavaScript
 */

import { build } from 'esbuild';
import path from 'path';

async function compileWorker() {
  console.log('Compiling worker...');
  
  await build({
    entryPoints: [path.join(__dirname, 'stats-worker.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(__dirname, 'stats-worker-compiled.js'),
    external: ['worker_threads'],
    format: 'cjs'
  });
  
  console.log('✅ Worker compiled successfully!');
}

compileWorker().catch(console.error);