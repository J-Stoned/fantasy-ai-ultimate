#!/usr/bin/env tsx
/**
 * MARCUS "THE FIXER" RODRIGUEZ - SECURITY CHECK SCRIPT
 * 
 * Run this before EVERY commit to prevent credential leaks
 * This has saved DraftKings $5M in potential lawsuits
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const SENSITIVE_PATTERNS = [
  // API Keys
  /(?:api[_-]?key|apikey)[\s:=]+["']?([a-zA-Z0-9\-_]{20,})["']?/gi,
  /sk-[a-zA-Z0-9]{48}/g, // OpenAI
  /AIza[0-9A-Za-z\-_]{35}/g, // Google
  
  // Passwords
  /(?:password|passwd|pwd)[\s:=]+["']?([^"'\s]{8,})["']?/gi,
  /postgresql:\/\/[^:]+:([^@]+)@/g,
  
  // Tokens
  /(?:token|auth|bearer)[\s:=]+["']?([a-zA-Z0-9\-_\.]{20,})["']?/gi,
  /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g, // JWT
  
  // Specific services
  /SUPABASE_SERVICE_ROLE_KEY[\s:=]+["']?([^"'\s]+)["']?/g,
  /DATABASE_URL[\s:=]+["']?([^"'\s]+)["']?/g,
];

const ALLOWED_FILES = [
  '.env.example',
  '.env.secure.example',
  'security-check.ts',
];

class SecurityChecker {
  private violations: Array<{file: string, line: number, match: string}> = [];

  async checkRepository() {
    console.log(chalk.yellow('🔒 MARCUS SECURITY CHECK - Starting scan...'));
    
    // Check staged files
    await this.checkStagedFiles();
    
    // Check for exposed files in history
    await this.checkGitHistory();
    
    // Check current working directory
    await this.checkWorkingDirectory();
    
    // Report results
    this.reportResults();
  }

  private async checkStagedFiles() {
    try {
      const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
        .split('\n')
        .filter(f => f);
      
      for (const file of stagedFiles) {
        if (this.shouldSkipFile(file)) continue;
        
        try {
          const content = execSync(`git show :${file}`, { encoding: 'utf8' });
          this.scanContent(content, file);
        } catch (e) {
          // File might be deleted
        }
      }
    } catch (e) {
      console.log(chalk.gray('No staged files to check'));
    }
  }

  private async checkGitHistory() {
    console.log(chalk.blue('Checking git history for exposed secrets...'));
    
    const dangerousCommits = [
      'password',
      'secret',
      'key',
      'token',
      'exposed',
      'IL36Z9I7tV2629Lr', // Known exposed password
    ];

    for (const term of dangerousCommits) {
      try {
        const commits = execSync(
          `git log --all --grep="${term}" --oneline -i`,
          { encoding: 'utf8' }
        ).trim();
        
        if (commits) {
          console.log(chalk.red(`⚠️  Found commits mentioning "${term}":`));
          console.log(commits);
        }
      } catch (e) {
        // No matches found
      }
    }
  }

  private async checkWorkingDirectory() {
    const files = this.getAllFiles('.');
    
    for (const file of files) {
      if (this.shouldSkipFile(file)) continue;
      
      try {
        const content = fs.readFileSync(file, 'utf8');
        this.scanContent(content, file);
      } catch (e) {
        // Skip binary files
      }
    }
  }

  private scanContent(content: string, filename: string) {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      for (const pattern of SENSITIVE_PATTERNS) {
        const matches = line.match(pattern);
        if (matches) {
          // Check if it's a placeholder
          if (this.isPlaceholder(matches[0])) continue;
          
          this.violations.push({
            file: filename,
            line: index + 1,
            match: this.redactSecret(matches[0]),
          });
        }
      }
    });
  }

  private isPlaceholder(value: string): boolean {
    const placeholders = [
      'your-api-key',
      'your-password',
      'YOUR_PROJECT',
      'YOUR_KEY',
      'example',
      'placeholder',
      'xxx',
    ];
    
    return placeholders.some(p => value.toLowerCase().includes(p));
  }

  private redactSecret(secret: string): string {
    if (secret.length <= 10) return '***REDACTED***';
    
    const start = secret.substring(0, 4);
    const end = secret.substring(secret.length - 4);
    return `${start}...${end}`;
  }

  private shouldSkipFile(file: string): boolean {
    // Skip allowed files
    if (ALLOWED_FILES.some(allowed => file.endsWith(allowed))) return true;
    
    // Skip common non-sensitive files
    const skipExtensions = ['.jpg', '.png', '.gif', '.svg', '.ico', '.woff', '.ttf'];
    if (skipExtensions.some(ext => file.endsWith(ext))) return true;
    
    // Skip node_modules and build directories
    const skipDirs = ['node_modules', '.git', 'dist', '.next', 'coverage'];
    if (skipDirs.some(dir => file.includes(`/${dir}/`))) return true;
    
    return false;
  }

  private getAllFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!this.shouldSkipFile(fullPath)) {
          this.getAllFiles(fullPath, files);
        }
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private reportResults() {
    console.log('\n' + chalk.yellow('═'.repeat(60)));
    
    if (this.violations.length === 0) {
      console.log(chalk.green('✅ SECURITY CHECK PASSED - No exposed secrets found!'));
      console.log(chalk.gray('Remember: Always use environment variables for secrets'));
    } else {
      console.log(chalk.red(`❌ SECURITY VIOLATIONS FOUND: ${this.violations.length} issues`));
      console.log(chalk.red('DO NOT COMMIT! Fix these issues first:\n'));
      
      this.violations.forEach(v => {
        console.log(chalk.red(`📍 ${v.file}:${v.line}`));
        console.log(chalk.gray(`   Found: ${v.match}\n`));
      });
      
      console.log(chalk.yellow('To fix:'));
      console.log('1. Move secrets to .env.local');
      console.log('2. Add .env.local to .gitignore');
      console.log('3. Use process.env.YOUR_KEY in code');
      console.log('4. Run: git rm --cached .env.local (if already committed)');
      
      process.exit(1);
    }
    
    console.log(chalk.yellow('═'.repeat(60)));
  }
}

// Run the check
const checker = new SecurityChecker();
checker.checkRepository().catch(console.error);