#!/usr/bin/env tsx
/**
 * Update .env.local to use local PostgreSQL database
 * This preserves all other settings while updating database connection
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const ENV_FILE = '.env.local';
const BACKUP_FILE = '.env.local.backup';

function updateEnvFile() {
  console.log(chalk.bold.cyan('🔧 Updating .env.local for Local PostgreSQL'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Check if .env.local exists
  if (!fs.existsSync(ENV_FILE)) {
    console.error(chalk.red('❌ .env.local not found!'));
    console.log('Please create .env.local first by copying .env.example');
    return;
  }
  
  // Read current env file
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  
  // Create backup
  fs.writeFileSync(BACKUP_FILE, envContent);
  console.log(chalk.green(`✅ Backup created: ${BACKUP_FILE}`));
  
  // Parse current values
  const lines = envContent.split('\n');
  const updatedLines: string[] = [];
  
  // Local database configuration
  const localDbConfig = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/fantasy_ai_local',
    DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/fantasy_ai_local',
    LOCAL_DB_PASSWORD: 'postgres' // Change this to your PostgreSQL password
  };
  
  let foundDatabaseUrl = false;
  
  // Update existing DATABASE_URL or add if missing
  lines.forEach(line => {
    if (line.startsWith('DATABASE_URL=') || line.startsWith('DIRECT_URL=')) {
      // Comment out the Supabase URL
      updatedLines.push(`# Supabase (Cloud) - Commented out for local development`);
      updatedLines.push(`# ${line}`);
      
      // Add local URL
      const key = line.startsWith('DATABASE_URL') ? 'DATABASE_URL' : 'DIRECT_URL';
      updatedLines.push(`${key}=${localDbConfig[key]}`);
      foundDatabaseUrl = true;
    } else if (line.startsWith('LOCAL_DB_PASSWORD=')) {
      // Update local password if it exists
      updatedLines.push(`LOCAL_DB_PASSWORD=${localDbConfig.LOCAL_DB_PASSWORD}`);
    } else {
      updatedLines.push(line);
    }
  });
  
  // Add DATABASE_URL if not found
  if (!foundDatabaseUrl) {
    updatedLines.push('');
    updatedLines.push('# Local PostgreSQL Database');
    updatedLines.push(`DATABASE_URL=${localDbConfig.DATABASE_URL}`);
    updatedLines.push(`DIRECT_URL=${localDbConfig.DIRECT_URL}`);
    updatedLines.push(`LOCAL_DB_PASSWORD=${localDbConfig.LOCAL_DB_PASSWORD}`);
  }
  
  // Write updated file
  fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));
  
  console.log(chalk.green('\n✅ .env.local updated for local PostgreSQL!'));
  console.log('\nLocal connection strings added:');
  console.log(chalk.yellow(`  DATABASE_URL=${localDbConfig.DATABASE_URL}`));
  console.log(chalk.yellow(`  DIRECT_URL=${localDbConfig.DIRECT_URL}`));
  
  console.log(chalk.bold('\n⚠️  IMPORTANT:'));
  console.log('1. Update LOCAL_DB_PASSWORD if you used a different password');
  console.log('2. Original Supabase URLs have been commented out');
  console.log('3. To switch back to Supabase, uncomment the original URLs');
  console.log('4. Backup saved as .env.local.backup');
  
  // Create a script to switch between local and cloud
  const switchScript = `#!/usr/bin/env tsx
// Switch between local and cloud database

import * as fs from 'fs';

const mode = process.argv[2];

if (!mode || !['local', 'cloud'].includes(mode)) {
  console.log('Usage: npm run db:switch [local|cloud]');
  process.exit(1);
}

const envContent = fs.readFileSync('.env.local', 'utf-8');
const lines = envContent.split('\\n');
const updatedLines: string[] = [];

let inLocalSection = false;
let inCloudSection = false;

lines.forEach(line => {
  if (line.includes('Supabase (Cloud)')) {
    inCloudSection = true;
    inLocalSection = false;
  } else if (line.includes('Local PostgreSQL')) {
    inLocalSection = true;
    inCloudSection = false;
  }
  
  if (mode === 'local') {
    // Enable local, disable cloud
    if (inCloudSection && line.startsWith('# DATABASE_URL=')) {
      updatedLines.push(line); // Keep commented
    } else if (inLocalSection && line.startsWith('# DATABASE_URL=')) {
      updatedLines.push(line.substring(2)); // Uncomment
    } else {
      updatedLines.push(line);
    }
  } else {
    // Enable cloud, disable local
    if (inCloudSection && line.startsWith('# DATABASE_URL=')) {
      updatedLines.push(line.substring(2)); // Uncomment
    } else if (inLocalSection && line.startsWith('DATABASE_URL=')) {
      updatedLines.push(\`# \${line}\`); // Comment
    } else {
      updatedLines.push(line);
    }
  }
});

fs.writeFileSync('.env.local', updatedLines.join('\\n'));
console.log(\`Switched to \${mode} database!\`);
`;
  
  fs.writeFileSync('scripts/local-db-setup/switch-database.ts', switchScript);
  console.log(chalk.green('\n✅ Database switch script created!'));
  console.log('Use: npm run db:switch local   OR   npm run db:switch cloud');
}

// Add to package.json scripts
function updatePackageJson() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  if (!packageJson.scripts['db:switch']) {
    packageJson.scripts['db:switch'] = 'tsx scripts/local-db-setup/switch-database.ts';
    packageJson.scripts['db:local'] = 'tsx scripts/local-db-setup/switch-database.ts local';
    packageJson.scripts['db:cloud'] = 'tsx scripts/local-db-setup/switch-database.ts cloud';
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('\n✅ Added database switch commands to package.json'));
  }
}

// Run the update
updateEnvFile();
updatePackageJson();