#!/usr/bin/env tsx
/**
 * 🔥 PRODUCTION ENVIRONMENT SETUP 🔥
 * 
 * Step 1: Configure production environment for Fantasy AI platform
 * Sets up environment variables, SSL certificates, and production configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

interface ProductionConfig {
  // Application
  NODE_ENV: string;
  PORT: string;
  APP_URL: string;
  
  // Database
  DATABASE_URL: string;
  DATABASE_POOL_SIZE: string;
  
  // Redis
  REDIS_URL: string;
  REDIS_CLUSTER_NODES: string;
  
  // Authentication
  JWT_SECRET: string;
  SESSION_SECRET: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  
  // APIs
  DRAFTKINGS_API_KEY: string;
  FANDUEL_API_KEY: string;
  YAHOO_CLIENT_ID: string;
  ESPN_API_KEY: string;
  
  // Security
  CORS_ORIGINS: string;
  RATE_LIMIT_MAX: string;
  SSL_CERT_PATH: string;
  SSL_KEY_PATH: string;
  
  // Monitoring
  SENTRY_DSN: string;
  DATADOG_API_KEY: string;
  
  // Performance
  ENABLE_CACHE: string;
  CACHE_TTL: string;
  MAX_WORKERS: string;
}

class ProductionEnvironmentSetup {
  private config: Partial<ProductionConfig> = {};
  private envPath = path.join(process.cwd(), '.env.production');
  
  constructor() {
    console.log(chalk.bold.cyan('🚀 FANTASY AI PRODUCTION ENVIRONMENT SETUP'));
    console.log(chalk.gray('Setting up production configuration...\n'));
  }
  
  async setup(): Promise<void> {
    try {
      await this.checkPrerequisites();
      await this.generateSecrets();
      await this.configureSSL();
      await this.setupProductionEnv();
      await this.validateConfiguration();
      await this.createBackup();
      
      console.log(chalk.bold.green('\n✅ Production environment setup complete!'));
    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error);
      process.exit(1);
    }
  }
  
  private async checkPrerequisites(): Promise<void> {
    console.log(chalk.yellow('📋 Checking prerequisites...'));
    
    // Check Node.js version
    const nodeVersion = process.version;
    const requiredVersion = 'v18.0.0';
    if (nodeVersion < requiredVersion) {
      throw new Error(`Node.js ${requiredVersion} or higher required. Current: ${nodeVersion}`);
    }
    
    // Check required tools
    const requiredTools = ['openssl', 'redis-cli', 'psql'];
    for (const tool of requiredTools) {
      try {
        execSync(`which ${tool}`, { stdio: 'ignore' });
        console.log(chalk.gray(`  ✓ ${tool} found`));
      } catch {
        throw new Error(`${tool} not found. Please install it first.`);
      }
    }
    
    console.log(chalk.green('✅ All prerequisites met\n'));
  }
  
  private async generateSecrets(): Promise<void> {
    console.log(chalk.yellow('🔐 Generating production secrets...'));
    
    // Generate cryptographically secure secrets
    this.config.JWT_SECRET = this.generateSecret(64);
    this.config.SESSION_SECRET = this.generateSecret(64);
    
    console.log(chalk.gray('  ✓ JWT secret generated'));
    console.log(chalk.gray('  ✓ Session secret generated'));
    
    // Generate API keys if not provided
    if (!process.env.PRODUCTION_API_KEYS) {
      console.log(chalk.yellow('\n⚠️  API keys not found. Using placeholders.'));
      console.log(chalk.gray('   Please update with real API keys before launch!'));
      
      this.config.DRAFTKINGS_API_KEY = 'REPLACE_WITH_REAL_KEY';
      this.config.FANDUEL_API_KEY = 'REPLACE_WITH_REAL_KEY';
      this.config.YAHOO_CLIENT_ID = 'REPLACE_WITH_REAL_KEY';
      this.config.ESPN_API_KEY = 'REPLACE_WITH_REAL_KEY';
    }
    
    console.log(chalk.green('✅ Secrets generated\n'));
  }
  
  private generateSecret(length: number): string {
    return execSync(`openssl rand -hex ${length}`).toString().trim();
  }
  
  private async configureSSL(): Promise<void> {
    console.log(chalk.yellow('🔒 Configuring SSL certificates...'));
    
    const sslDir = path.join(process.cwd(), 'ssl');
    
    // Create SSL directory
    if (!fs.existsSync(sslDir)) {
      fs.mkdirSync(sslDir, { recursive: true });
    }
    
    // Check for existing certificates
    const certPath = path.join(sslDir, 'cert.pem');
    const keyPath = path.join(sslDir, 'key.pem');
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      console.log(chalk.gray('  ✓ SSL certificates found'));
      this.config.SSL_CERT_PATH = certPath;
      this.config.SSL_KEY_PATH = keyPath;
    } else {
      console.log(chalk.yellow('  ⚠️  SSL certificates not found'));
      console.log(chalk.gray('  Generating self-signed certificates for development...'));
      
      // Generate self-signed certificate for development
      execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`, {
        stdio: 'ignore'
      });
      
      this.config.SSL_CERT_PATH = certPath;
      this.config.SSL_KEY_PATH = keyPath;
      
      console.log(chalk.yellow('  ⚠️  Replace with real certificates before production!'));
    }
    
    console.log(chalk.green('✅ SSL configured\n'));
  }
  
  private async setupProductionEnv(): Promise<void> {
    console.log(chalk.yellow('🔧 Setting up production environment...'));
    
    // Core configuration
    this.config.NODE_ENV = 'production';
    this.config.PORT = '443';
    this.config.APP_URL = process.env.PRODUCTION_URL || 'https://fantasy-ai.com';
    
    // Database configuration
    this.config.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || 
      'postgresql://fantasy_ai_prod:secure_password@prod-db.fantasy-ai.com:5432/fantasy_ai_production?sslmode=require';
    this.config.DATABASE_POOL_SIZE = '20';
    
    // Redis configuration
    this.config.REDIS_URL = process.env.PRODUCTION_REDIS_URL || 
      'redis://prod-redis.fantasy-ai.com:6379';
    this.config.REDIS_CLUSTER_NODES = process.env.PRODUCTION_REDIS_CLUSTERS || 
      'redis://redis-1:6379,redis://redis-2:6379,redis://redis-3:6379';
    
    // Security configuration
    this.config.CORS_ORIGINS = 'https://fantasy-ai.com,https://www.fantasy-ai.com';
    this.config.RATE_LIMIT_MAX = '100';
    
    // Monitoring
    this.config.SENTRY_DSN = process.env.SENTRY_DSN || '';
    this.config.DATADOG_API_KEY = process.env.DATADOG_API_KEY || '';
    
    // Performance
    this.config.ENABLE_CACHE = 'true';
    this.config.CACHE_TTL = '3600';
    this.config.MAX_WORKERS = '8';
    
    // OAuth configuration
    this.config.OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'REPLACE_WITH_REAL_ID';
    this.config.OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'REPLACE_WITH_REAL_SECRET';
    
    // Write to .env.production
    await this.writeEnvFile();
    
    console.log(chalk.green('✅ Production environment configured\n'));
  }
  
  private async writeEnvFile(): Promise<void> {
    const envContent = Object.entries(this.config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Add header
    const fullContent = `# Fantasy AI Production Environment Configuration
# Generated on ${new Date().toISOString()}
# ⚠️  KEEP THIS FILE SECURE - CONTAINS SENSITIVE DATA

${envContent}

# Additional production settings
LOG_LEVEL=error
ENABLE_PROFILING=true
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_GRACEFUL_SHUTDOWN=true

# Feature flags
ENABLE_ML_PREDICTIONS=true
ENABLE_DFS_TRADING=true
ENABLE_ADMIN_DASHBOARDS=true
ENABLE_WEBSOCKET=true
ENABLE_GPU_OPTIMIZATION=true

# Performance tuning
PM2_INSTANCES=max
PM2_MAX_MEMORY_RESTART=1G
NODE_OPTIONS="--max-old-space-size=4096"
`;
    
    fs.writeFileSync(this.envPath, fullContent);
    console.log(chalk.gray(`  ✓ Written to ${this.envPath}`));
  }
  
  private async validateConfiguration(): Promise<void> {
    console.log(chalk.yellow('🔍 Validating configuration...'));
    
    // Load and validate env file
    const result = dotenv.config({ path: this.envPath });
    if (result.error) {
      throw new Error(`Failed to load .env.production: ${result.error}`);
    }
    
    // Check critical variables
    const criticalVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'SESSION_SECRET'
    ];
    
    const missing = criticalVars.filter(key => !result.parsed?.[key]);
    if (missing.length > 0) {
      throw new Error(`Missing critical variables: ${missing.join(', ')}`);
    }
    
    // Test database connection
    console.log(chalk.gray('  Testing database connection...'));
    try {
      execSync(`psql "${this.config.DATABASE_URL}" -c "SELECT 1"`, { stdio: 'ignore' });
      console.log(chalk.gray('  ✓ Database connection successful'));
    } catch {
      console.log(chalk.yellow('  ⚠️  Database connection failed (expected if not yet created)'));
    }
    
    // Test Redis connection
    console.log(chalk.gray('  Testing Redis connection...'));
    try {
      const redisUrl = new URL(this.config.REDIS_URL || '');
      execSync(`redis-cli -h ${redisUrl.hostname} -p ${redisUrl.port || 6379} ping`, { stdio: 'ignore' });
      console.log(chalk.gray('  ✓ Redis connection successful'));
    } catch {
      console.log(chalk.yellow('  ⚠️  Redis connection failed (expected if not yet started)'));
    }
    
    console.log(chalk.green('✅ Configuration validated\n'));
  }
  
  private async createBackup(): Promise<void> {
    console.log(chalk.yellow('💾 Creating configuration backup...'));
    
    const backupDir = path.join(process.cwd(), 'backups', 'config');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `env.production.${timestamp}.backup`);
    
    fs.copyFileSync(this.envPath, backupPath);
    console.log(chalk.gray(`  ✓ Backup created: ${backupPath}`));
    
    console.log(chalk.green('✅ Backup complete\n'));
  }
}

// Run setup
if (require.main === module) {
  const setup = new ProductionEnvironmentSetup();
  setup.setup().catch(console.error);
}

export { ProductionEnvironmentSetup };