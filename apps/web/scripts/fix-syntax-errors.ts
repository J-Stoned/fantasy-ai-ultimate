#!/usr/bin/env ts-node

/**
 * Fix syntax errors from console replacement script
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

async function fixSyntaxErrors() {
  console.log('🔧 Fixing syntax errors from console replacement...');

  const fixes = [
    // Fix missing commas in logger calls
    {
      pattern: /logger\.(info|warn|error|debug)\(['"](.*?)['"]([a-zA-Z_])/g,
      replacement: 'logger.$1(\'$2\', $3',
    },
    // Fix missing commas in template literals
    {
      pattern: /\$\{(.*?)\}:['"]([a-zA-Z_])/g,
      replacement: '${$1}:\', $2',
    },
    // Fix JSX in .ts files by checking content
    {
      files: ['**/*.ts'],
      checkContent: /<\w+\s+[\w-]+=/,
      action: 'rename-to-tsx',
    },
  ];

  // Get all TypeScript files
  const files = await glob('src/**/*.{ts,tsx}', { 
    cwd: process.cwd(),
    ignore: ['**/node_modules/**', '**/*.d.ts']
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;

    // Apply regex fixes
    for (const fix of fixes.filter(f => f.pattern)) {
      const newContent = content.replace(fix.pattern!, fix.replacement!);
      if (newContent !== content) {
        content = newContent;
        modified = true;
        fixedCount++;
      }
    }

    // Check for JSX in .ts files
    if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const hasJSX = /<\w+\s+[\w-]+=/g.test(content) || /<\/\w+>/g.test(content);
      if (hasJSX) {
        const newPath = filePath.replace(/\.ts$/, '.tsx');
        await fs.rename(filePath, newPath);
        console.log(`  📝 Renamed ${file} to .tsx (contains JSX)`);
        fixedCount++;
      }
    }

    if (modified) {
      await fs.writeFile(filePath, content);
      console.log(`  ✅ Fixed ${file}`);
    }
  }

  console.log(`\n✨ Fixed ${fixedCount} issues!`);
}

// Run the script
fixSyntaxErrors().catch(console.error);