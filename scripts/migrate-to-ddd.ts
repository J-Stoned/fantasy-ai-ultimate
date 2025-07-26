#!/usr/bin/env tsx
/**
 * Script to migrate remaining files to DDD structure
 * Run this to complete the reorganization
 */

import { promises as fs } from 'fs';
import path from 'path';

interface MigrationRule {
  pattern: RegExp;
  destination: string;
}

const migrationRules: MigrationRule[] = [
  // Player domain
  { pattern: /player|roster/i, destination: 'domains/player/collectors' },
  { pattern: /analyze.*player/i, destination: 'domains/player/analyzers' },
  
  // Stats domain  
  { pattern: /stats.*collector|collect.*stats/i, destination: 'domains/stats/collectors' },
  { pattern: /stats.*calculator|scoring/i, destination: 'domains/stats/calculators' },
  { pattern: /analyze.*stats|stats.*analysis/i, destination: 'domains/stats/analyzers' },
  { pattern: /check.*stats|verify.*stats|validate/i, destination: 'domains/stats/validators' },
  
  // Game domain
  { pattern: /game|match/i, destination: 'domains/game/collectors' },
  
  // ML domain
  { pattern: /train|training/i, destination: 'domains/ml/training' },
  { pattern: /model|predictor/i, destination: 'domains/ml/models' },
  { pattern: /predict|projection/i, destination: 'domains/ml/prediction' },
  { pattern: /enrichment|feature/i, destination: 'domains/ml/enrichment' },
  
  // Fantasy domain
  { pattern: /dfs|daily/i, destination: 'domains/fantasy/dfs' },
  { pattern: /lineup|optimizer/i, destination: 'domains/fantasy/optimization' },
  { pattern: /fantasy.*scoring|scoring.*engine/i, destination: 'domains/fantasy/scoring' },
  
  // Betting domain
  { pattern: /betting|vegas|odds/i, destination: 'domains/betting/lines' },
  { pattern: /props/i, destination: 'domains/betting/props' },
  
  // Infrastructure domain
  { pattern: /database|schema|table/i, destination: 'domains/infrastructure/database' },
  { pattern: /cache|redis/i, destination: 'domains/infrastructure/cache' },
  { pattern: /auth|jwt|session/i, destination: 'domains/infrastructure/auth' },
  { pattern: /deploy|production/i, destination: 'domains/infrastructure/deployment' },
  
  // Migrations
  { pattern: /cleanup|clean.*duplicate|fix.*duplicate/i, destination: 'migrations/cleanup' },
  { pattern: /migrate|migration/i, destination: 'migrations/data' },
  { pattern: /\.sql$/i, destination: 'migrations/schema' },
  
  // Tools
  { pattern: /test|debug|check/i, destination: 'tools/diagnostics' },
  { pattern: /monitor|analyze/i, destination: 'tools/monitoring' },
];

async function migrateFiles() {
  const scriptsDir = process.cwd();
  const files = await fs.readdir(scriptsDir);
  
  let movedCount = 0;
  let skippedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(scriptsDir, file);
    const stat = await fs.stat(filePath);
    
    // Skip directories and this script
    if (stat.isDirectory() || file === 'migrate-to-ddd.ts') {
      continue;
    }
    
    // Find matching rule
    let moved = false;
    for (const rule of migrationRules) {
      if (rule.pattern.test(file)) {
        const destDir = path.join(scriptsDir, rule.destination);
        const destPath = path.join(destDir, file);
        
        try {
          // Ensure destination directory exists
          await fs.mkdir(destDir, { recursive: true });
          
          // Move file
          await fs.rename(filePath, destPath);
          console.log(`✅ Moved ${file} → ${rule.destination}/`);
          movedCount++;
          moved = true;
          break;
        } catch (error) {
          console.error(`❌ Failed to move ${file}:`, error.message);
        }
      }
    }
    
    if (!moved) {
      console.log(`⚠️  Skipped ${file} - no matching rule`);
      skippedCount++;
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Moved: ${movedCount} files`);
  console.log(`   ⚠️  Skipped: ${skippedCount} files`);
  
  // List remaining files
  const remainingFiles = await fs.readdir(scriptsDir);
  const remaining = remainingFiles.filter(f => {
    return !['domains', 'shared', 'migrations', 'tools', 'migrate-to-ddd.ts', 'README.md', 'DOMAIN_STRUCTURE.md'].includes(f);
  });
  
  if (remaining.length > 0) {
    console.log(`\n📁 Remaining files in root:`);
    remaining.forEach(f => console.log(`   - ${f}`));
  }
}

// Run migration
migrateFiles().catch(console.error);