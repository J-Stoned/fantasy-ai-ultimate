#!/usr/bin/env tsx

/**
 * 🔐 PASSWORD HASH GENERATOR 🔐
 * 
 * Utility script to generate bcrypt hashes for admin passwords
 * Usage: npm run admin:hash-password
 */

import { hashPassword, checkPasswordStrength, generateSecurePassword } from '../src/lib/utils/password';
import * as readline from 'readline';
import { promisify } from 'util';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

async function main() {
  console.log('🔐 ADMIN PASSWORD HASH GENERATOR 🔐\n');
  console.log('This tool will help you generate a secure bcrypt hash for your admin password.\n');

  try {
    // Ask if they want to generate a password or use their own
    const choice = await question('Do you want to:\n1. Generate a secure password\n2. Use your own password\n\nEnter choice (1 or 2): ');
    
    let password: string;
    
    if (choice.trim() === '1') {
      // Generate password
      const lengthStr = await question('\nPassword length (16-32, default 20): ');
      const length = parseInt(lengthStr) || 20;
      
      if (length < 16 || length > 32) {
        console.error('❌ Password length must be between 16 and 32 characters');
        process.exit(1);
      }
      
      password = generateSecurePassword(length);
      console.log(`\n✅ Generated secure password: ${password}`);
      console.log('⚠️  IMPORTANT: Save this password securely! You won\'t see it again.\n');
      
    } else if (choice.trim() === '2') {
      // Use custom password
      console.log('\nPassword requirements:');
      console.log('- At least 12 characters');
      console.log('- Must contain uppercase and lowercase letters');
      console.log('- Must contain numbers');
      console.log('- Must contain special characters');
      console.log('- Cannot contain common patterns\n');
      
      // Hide password input
      const passwordInput = await question('Enter your password: ');
      password = passwordInput;
      
      // Check password strength
      const strength = checkPasswordStrength(password);
      
      if (!strength.isValid) {
        console.error('\n❌ Password does not meet security requirements:\n');
        strength.issues.forEach(issue => console.error(`  - ${issue}`));
        console.log('\n💡 Suggestions:');
        strength.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
        process.exit(1);
      }
      
      console.log(`\n✅ Password strength: ${strength.score}/100`);
      
    } else {
      console.error('❌ Invalid choice');
      process.exit(1);
    }

    // Generate hash
    console.log('\n🔄 Generating bcrypt hash...');
    const result = await hashPassword(password);
    
    if (!result.success || !result.hash) {
      console.error('❌ Failed to generate hash:', result.error);
      process.exit(1);
    }

    console.log('\n✅ Password hash generated successfully!\n');
    console.log('📋 Add these to your .env.local file:\n');
    console.log(`ADMIN_EMAIL="your-admin-email@example.com"`);
    console.log(`ADMIN_PASSWORD_HASH="${result.hash}"`);
    console.log(`ADMIN_PASSWORD_IS_SHA256="false"`);
    console.log(`ADMIN_MFA_SECRET="your-mfa-secret-here"`);
    console.log(`BCRYPT_SALT_ROUNDS="12"`);
    
    console.log('\n💡 Security tips:');
    console.log('- Never commit .env files to version control');
    console.log('- Use different passwords for different environments');
    console.log('- Enable MFA for additional security');
    console.log('- Rotate passwords regularly');
    console.log('- Monitor failed login attempts');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main().catch(console.error);