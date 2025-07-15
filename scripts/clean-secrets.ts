#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

// Patterns to replace
const SECRETS_TO_REPLACE = {
  // Supabase JWT
  process.env.SUPABASE_SERVICE_KEY || '': "process.env.SUPABASE_SERVICE_KEY || ''",
  
  // Supabase anon key
  process.env.SUPABASE_ANON_KEY || '': "process.env.SUPABASE_ANON_KEY || ''",
  
  // Database password
  process.env.DB_PASSWORD || '': "process.env.DB_PASSWORD || ''",
  
  // Full connection strings
  process.env.DATABASE_URL || '': "process.env.DATABASE_URL || ''",
  
  // API placeholder keys
  process.env.RAPIDAPI_KEY || '': "process.env.RAPIDAPI_KEY || ''",
  process.env.ODDS_API_KEY || '': "process.env.ODDS_API_KEY || ''"
};

async function cleanFile(filePath: string) {
  try {
    let content = await readFile(filePath, 'utf-8');
    let modified = false;
    
    for (const [secret, replacement] of Object.entries(SECRETS_TO_REPLACE)) {
      if (content.includes(secret)) {
        // For string literals, keep the quotes
        const quotedSecret = `'${secret}'`;
        const quotedSecret2 = `"${secret}"`;
        
        if (content.includes(quotedSecret)) {
          content = content.replace(new RegExp(quotedSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
          modified = true;
        } else if (content.includes(quotedSecret2)) {
          content = content.replace(new RegExp(quotedSecret2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
          modified = true;
        } else {
          // For unquoted occurrences (like in connection strings)
          content = content.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
          modified = true;
        }
      }
    }
    
    if (modified) {
      await writeFile(filePath, content);
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

async function cleanDirectory(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  let totalCleaned = 0;
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    // Skip node_modules, .git, etc
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    
    if (entry.isDirectory()) {
      totalCleaned += await cleanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.md'))) {
      const cleaned = await cleanFile(fullPath);
      if (cleaned) totalCleaned++;
    }
  }
  
  return totalCleaned;
}

async function main() {
  console.log('🔒 Cleaning secrets from codebase...\n');
  
  const scriptsDir = join(process.cwd(), 'scripts');
  const libDir = join(process.cwd(), 'lib');
  const rootFiles = ['FIX_MCP_SERVERS.md'];
  
  let totalCleaned = 0;
  
  // Clean scripts directory
  console.log('📁 Cleaning scripts directory...');
  totalCleaned += await cleanDirectory(scriptsDir);
  
  // Clean lib directory
  console.log('\n📁 Cleaning lib directory...');
  totalCleaned += await cleanDirectory(libDir);
  
  // Clean root files
  console.log('\n📄 Cleaning root files...');
  for (const file of rootFiles) {
    const cleaned = await cleanFile(join(process.cwd(), file));
    if (cleaned) totalCleaned++;
  }
  
  console.log(`\n✅ Complete! Cleaned ${totalCleaned} files.`);
  console.log('\n📝 Next steps:');
  console.log('1. Create a .env file with your actual keys');
  console.log('2. Update all scripts to use environment variables');
  console.log('3. Run: git add -A && git commit');
}

main().catch(console.error);