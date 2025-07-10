#!/usr/bin/env tsx
/**
 * MARCUS "THE FIXER" RODRIGUEZ - SECRET VERIFICATION SCRIPT
 * 
 * Run this to ensure your environment is properly configured
 * This catches 90% of "works on my machine" issues
 */

import chalk from 'chalk';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(chalk.red('❌ .env.local not found! Create it from .env.secure.example'));
  process.exit(1);
}

interface SecretCheck {
  name: string;
  required: boolean;
  pattern?: RegExp;
  minLength?: number;
  validator?: (value: string) => boolean;
  description: string;
}

const REQUIRED_SECRETS: SecretCheck[] = [
  // Supabase
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
    description: 'Supabase project URL',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    pattern: /^eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/,
    description: 'Supabase anonymous key (JWT)',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    pattern: /^eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/,
    description: 'Supabase service role key (JWT)',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/\w+/,
    validator: (value: string) => !value.includes('${DB_PASSWORD}'),
    description: 'PostgreSQL connection string',
  },
  
  // Redis
  {
    name: 'REDIS_URL',
    required: true,
    pattern: /^redis:\/\/.+/,
    description: 'Redis connection URL',
  },
  
  // Sports APIs
  {
    name: 'BALLDONTLIE_API_KEY',
    required: false,
    minLength: 20,
    description: 'Ball Don\'t Lie API key for NBA data',
  },
  {
    name: 'SPORTRADAR_API_KEY',
    required: false,
    pattern: /^[a-f0-9]{32}$/,
    description: 'SportsRadar API key',
  },
  
  // AI Services
  {
    name: 'OPENAI_API_KEY',
    required: false,
    pattern: /^sk-[A-Za-z0-9]{48}$/,
    description: 'OpenAI API key',
  },
  
  // Security
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    minLength: 32,
    description: 'NextAuth secret for session encryption',
  },
];

const DANGEROUS_VALUES = [
  'your-api-key',
  'your-password',
  'YOUR_PROJECT',
  'YOUR_KEY',
  'example',
  '${DB_PASSWORD}', // Known exposed password
];

class SecretVerifier {
  private errors: string[] = [];
  private warnings: string[] = [];
  private success: string[] = [];

  async verify() {
    console.log(chalk.yellow('🔐 MARCUS SECRET VERIFICATION - Starting check...\n'));

    // Check each secret
    for (const secret of REQUIRED_SECRETS) {
      this.checkSecret(secret);
    }

    // Check for dangerous values
    this.checkForDangerousValues();

    // Check Redis connection
    await this.checkRedisConnection();

    // Check Supabase connection
    await this.checkSupabaseConnection();

    // Report results
    this.report();
  }

  private checkSecret(secret: SecretCheck) {
    const value = process.env[secret.name];

    if (!value) {
      if (secret.required) {
        this.errors.push(`❌ ${secret.name} is missing (${secret.description})`);
      } else {
        this.warnings.push(`⚠️  ${secret.name} is missing (${secret.description})`);
      }
      return;
    }

    // Check for placeholder values
    if (DANGEROUS_VALUES.some(danger => value.includes(danger))) {
      this.errors.push(`❌ ${secret.name} contains placeholder value: "${value}"`);
      return;
    }

    // Check pattern
    if (secret.pattern && !secret.pattern.test(value)) {
      this.errors.push(`❌ ${secret.name} has invalid format`);
      return;
    }

    // Check minimum length
    if (secret.minLength && value.length < secret.minLength) {
      this.errors.push(`❌ ${secret.name} is too short (min: ${secret.minLength})`);
      return;
    }

    // Custom validation
    if (secret.validator && !secret.validator(value)) {
      this.errors.push(`❌ ${secret.name} failed custom validation`);
      return;
    }

    this.success.push(`✅ ${secret.name} is properly configured`);
  }

  private checkForDangerousValues() {
    const envContent = readFileSync(envPath, 'utf8');
    
    if (envContent.includes('${DB_PASSWORD}')) {
      this.errors.push('❌ CRITICAL: Exposed password found in .env.local!');
    }
  }

  private async checkRedisConnection() {
    if (!process.env.REDIS_URL) return;

    try {
      // Simple check - in production use actual Redis client
      const url = new URL(process.env.REDIS_URL);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        this.warnings.push('⚠️  Redis is pointing to localhost - use Redis Cloud for production');
      } else {
        this.success.push('✅ Redis URL looks production-ready');
      }
    } catch (error) {
      this.errors.push('❌ Invalid Redis URL format');
    }
  }

  private async checkSupabaseConnection() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
      });
      
      if (response.ok) {
        this.success.push('✅ Supabase URL is reachable');
      } else {
        this.warnings.push('⚠️  Supabase URL returned status: ' + response.status);
      }
    } catch (error) {
      this.warnings.push('⚠️  Could not verify Supabase connection');
    }
  }

  private report() {
    console.log(chalk.green('\nSuccesses:'));
    this.success.forEach(s => console.log(s));

    if (this.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      this.warnings.forEach(w => console.log(w));
    }

    if (this.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      this.errors.forEach(e => console.log(e));
      
      console.log(chalk.red('\n❌ VERIFICATION FAILED!'));
      console.log(chalk.yellow('\nTo fix:'));
      console.log('1. Copy .env.secure.example to .env.local');
      console.log('2. Fill in all required values');
      console.log('3. Ensure no placeholder values remain');
      console.log('4. Run this script again');
      
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ ALL CHECKS PASSED!'));
      console.log(chalk.gray('Your environment is properly configured for development'));
      
      if (this.warnings.length > 0) {
        console.log(chalk.yellow('\nNote: Address warnings before production deployment'));
      }
    }
  }
}

// Run verification
const verifier = new SecretVerifier();
verifier.verify().catch(console.error);