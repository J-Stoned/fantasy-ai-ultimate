#!/usr/bin/env tsx
/**
 * EMERGENCY SECURITY CHECK
 * Run this after rotating credentials to verify security
 */

import chalk from 'chalk';

console.log(chalk.red.bold('\n🚨 SUPABASE SECURITY CHECK 🚨\n'));

console.log(chalk.yellow('IMMEDIATE ACTIONS REQUIRED:\n'));

console.log('1. ' + chalk.red.bold('GO TO SUPABASE DASHBOARD NOW'));
console.log('   https://app.supabase.com\n');

console.log('2. ' + chalk.red.bold('FIND YOUR PROJECT'));
console.log('   Project ID: pvekvqiqrrpugfmpgaup\n');

console.log('3. ' + chalk.red.bold('RESET DATABASE PASSWORD'));
console.log('   Settings → Database → Reset Database Password\n');

console.log('4. ' + chalk.red.bold('GENERATE NEW API KEYS'));
console.log('   Settings → API → Regenerate Keys\n');

console.log('5. ' + chalk.red.bold('CHECK ACCESS LOGS'));
console.log('   Database → Logs → Look for suspicious activity\n');

console.log(chalk.red('═'.repeat(60)));
console.log(chalk.red.bold('\nTHE FOLLOWING CREDENTIALS ARE COMPROMISED:'));
console.log(chalk.red('- Database Password: ${DB_PASSWORD}'));
console.log(chalk.red('- Project URL: https://pvekvqiqrrpugfmpgaup.supabase.co'));
console.log(chalk.red('- All API keys associated with this project'));
console.log(chalk.red('═'.repeat(60)));

console.log(chalk.yellow('\nAfter rotating credentials:'));
console.log('1. Update .env.local with new values');
console.log('2. Update any deployed environments');
console.log('3. Run: npm run verify:secrets');
console.log('4. Enable RLS on all tables');
console.log('5. Set up 2FA on your Supabase account\n');

console.log(chalk.green('Run this script again after rotation to verify.\n'));

// Check if we can still access with old credentials
async function checkOldCredentials() {
  console.log(chalk.yellow('Checking if old credentials are still active...'));
  
  const oldUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
  
  try {
    const response = await fetch(`${oldUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': 'process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
    });
    
    if (response.status === 200 || response.status === 401) {
      console.log(chalk.red('\n⚠️  OLD CREDENTIALS ARE STILL ACTIVE!'));
      console.log(chalk.red('ROTATE IMMEDIATELY!\n'));
    } else {
      console.log(chalk.green('\n✅ Old credentials appear to be disabled.\n'));
    }
  } catch (error) {
    console.log(chalk.gray('\nCould not verify credential status.\n'));
  }
}

checkOldCredentials();