#!/usr/bin/env tsx
/**
 * 💎 PATTERN LICENSING PLATFORM
 * 
 * Monetize pattern insights through licensing tiers
 * Manage API keys, usage limits, and billing
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import Stripe from 'stripe';

config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3348;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Stripe (would use real key in production)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo', {
  apiVersion: '2023-10-16'
});

interface LicenseTier {
  id: string;
  name: string;
  description: string;
  price: number; // Monthly price in USD
  features: {
    apiCallsPerMonth: number;
    patterns: string[];
    sports: string[];
    realTimeAccess: boolean;
    historicalData: boolean;
    customAlerts: boolean;
    whiteLabel: boolean;
    support: 'community' | 'email' | 'priority' | 'dedicated';
  };
  stripeProductId?: string;
  stripePriceId?: string;
}

interface License {
  id: string;
  userId: string;
  tierId: string;
  apiKey: string;
  secretKey: string;
  status: 'active' | 'suspended' | 'cancelled';
  usageThisMonth: number;
  limitThisMonth: number;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  metadata: {
    company?: string;
    useCase?: string;
    website?: string;
  };
}

interface UsageEvent {
  licenseId: string;
  endpoint: string;
  pattern?: string;
  sport?: string;
  timestamp: Date;
  responseTime: number;
  success: boolean;
  error?: string;
}

class PatternLicensingPlatform {
  private tiers: LicenseTier[] = [
    {
      id: 'free',
      name: 'Free Tier',
      description: 'Perfect for trying out our pattern API',
      price: 0,
      features: {
        apiCallsPerMonth: 100,
        patterns: ['backToBackFade', 'revengeGame'],
        sports: ['nfl'],
        realTimeAccess: false,
        historicalData: false,
        customAlerts: false,
        whiteLabel: false,
        support: 'community'
      }
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'Great for individual developers and small projects',
      price: 99,
      features: {
        apiCallsPerMonth: 10000,
        patterns: ['backToBackFade', 'revengeGame', 'altitudeAdvantage', 'primetimeUnder'],
        sports: ['nfl', 'nba'],
        realTimeAccess: true,
        historicalData: false,
        customAlerts: false,
        whiteLabel: false,
        support: 'email'
      },
      stripePriceId: 'price_starter_monthly'
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'For serious sports analysts and betting professionals',
      price: 499,
      features: {
        apiCallsPerMonth: 100000,
        patterns: ['all'],
        sports: ['nfl', 'nba', 'mlb', 'nhl'],
        realTimeAccess: true,
        historicalData: true,
        customAlerts: true,
        whiteLabel: false,
        support: 'priority'
      },
      stripePriceId: 'price_professional_monthly'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Full access with white-label options',
      price: 2999,
      features: {
        apiCallsPerMonth: 1000000,
        patterns: ['all'],
        sports: ['all'],
        realTimeAccess: true,
        historicalData: true,
        customAlerts: true,
        whiteLabel: true,
        support: 'dedicated'
      },
      stripePriceId: 'price_enterprise_monthly'
    }
  ];
  
  private licenses: Map<string, License> = new Map();
  private usageEvents: UsageEvent[] = [];
  
  async initialize() {
    console.log(chalk.cyan('💎 Initializing Pattern Licensing Platform...'));
    
    // Create database tables
    await this.createTables();
    
    // Load existing licenses
    await this.loadLicenses();
    
    // Start usage monitoring
    this.startUsageMonitoring();
    
    console.log(chalk.green('✅ Pattern Licensing Platform ready'));
  }
  
  private async createTables() {
    console.log(chalk.yellow('Creating licensing tables...'));
    
    try {
      // Create licenses table
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS pattern_licenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            tier_id VARCHAR(50) NOT NULL,
            api_key VARCHAR(64) UNIQUE NOT NULL,
            secret_key VARCHAR(128) NOT NULL,
            status VARCHAR(20) NOT NULL,
            usage_this_month INTEGER DEFAULT 0,
            limit_this_month INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP NOT NULL,
            last_used_at TIMESTAMP,
            metadata JSONB,
            stripe_subscription_id VARCHAR(255),
            FOREIGN KEY (user_id) REFERENCES auth.users(id)
          );
          
          CREATE INDEX IF NOT EXISTS idx_licenses_api_key ON pattern_licenses(api_key);
          CREATE INDEX IF NOT EXISTS idx_licenses_user ON pattern_licenses(user_id);
        `
      });
      
      // Create usage events table
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS pattern_usage_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            license_id UUID NOT NULL,
            endpoint VARCHAR(255) NOT NULL,
            pattern VARCHAR(100),
            sport VARCHAR(50),
            timestamp TIMESTAMP DEFAULT NOW(),
            response_time INTEGER,
            success BOOLEAN NOT NULL,
            error TEXT,
            ip_address INET,
            user_agent TEXT,
            FOREIGN KEY (license_id) REFERENCES pattern_licenses(id)
          );
          
          CREATE INDEX IF NOT EXISTS idx_usage_license ON pattern_usage_events(license_id);
          CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON pattern_usage_events(timestamp);
        `
      });
      
      // Create billing history table
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS pattern_billing_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            license_id UUID NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'USD',
            status VARCHAR(20) NOT NULL,
            stripe_payment_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            metadata JSONB,
            FOREIGN KEY (license_id) REFERENCES pattern_licenses(id)
          );
        `
      });
      
      console.log(chalk.green('✅ Tables created successfully'));
    } catch (error) {
      console.error(chalk.red('Error creating tables:'), error);
    }
  }
  
  private async loadLicenses() {
    const { data: licenses } = await supabase
      .from('pattern_licenses')
      .select('*')
      .eq('status', 'active');
      
    licenses?.forEach(license => {
      this.licenses.set(license.api_key, license);
    });
    
    console.log(chalk.blue(`📋 Loaded ${this.licenses.size} active licenses`));
  }
  
  private generateApiKey(): string {
    return `pk_${crypto.randomBytes(24).toString('hex')}`;
  }
  
  private generateSecretKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }
  
  async createLicense(
    userId: string,
    tierId: string,
    metadata?: any
  ): Promise<License> {
    const tier = this.tiers.find(t => t.id === tierId);
    if (!tier) throw new Error('Invalid tier');
    
    const license: License = {
      id: crypto.randomUUID(),
      userId,
      tierId,
      apiKey: this.generateApiKey(),
      secretKey: this.generateSecretKey(),
      status: 'active',
      usageThisMonth: 0,
      limitThisMonth: tier.features.apiCallsPerMonth,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: metadata || {}
    };
    
    // Save to database
    await supabase
      .from('pattern_licenses')
      .insert({
        ...license,
        user_id: license.userId,
        tier_id: license.tierId,
        api_key: license.apiKey,
        secret_key: license.secretKey,
        usage_this_month: license.usageThisMonth,
        limit_this_month: license.limitThisMonth,
        created_at: license.createdAt,
        expires_at: license.expiresAt,
        last_used_at: license.lastUsedAt
      });
    
    this.licenses.set(license.apiKey, license);
    
    console.log(chalk.green(`✅ Created ${tier.name} license for user ${userId}`));
    
    return license;
  }
  
  async validateApiKey(apiKey: string, secretKey?: string): Promise<{
    valid: boolean;
    license?: License;
    tier?: LicenseTier;
    reason?: string;
  }> {
    const license = this.licenses.get(apiKey);
    
    if (!license) {
      return { valid: false, reason: 'Invalid API key' };
    }
    
    if (secretKey && license.secretKey !== secretKey) {
      return { valid: false, reason: 'Invalid secret key' };
    }
    
    if (license.status !== 'active') {
      return { valid: false, reason: `License ${license.status}` };
    }
    
    if (new Date() > license.expiresAt) {
      return { valid: false, reason: 'License expired' };
    }
    
    const tier = this.tiers.find(t => t.id === license.tierId);
    if (!tier) {
      return { valid: false, reason: 'Invalid tier' };
    }
    
    if (license.usageThisMonth >= license.limitThisMonth) {
      return { valid: false, reason: 'Usage limit exceeded' };
    }
    
    return { valid: true, license, tier };
  }
  
  async trackUsage(
    apiKey: string,
    endpoint: string,
    details: {
      pattern?: string;
      sport?: string;
      responseTime: number;
      success: boolean;
      error?: string;
    }
  ) {
    const license = this.licenses.get(apiKey);
    if (!license) return;
    
    // Update usage count
    license.usageThisMonth++;
    license.lastUsedAt = new Date();
    
    // Create usage event
    const event: UsageEvent = {
      licenseId: license.id,
      endpoint,
      pattern: details.pattern,
      sport: details.sport,
      timestamp: new Date(),
      responseTime: details.responseTime,
      success: details.success,
      error: details.error
    };
    
    this.usageEvents.push(event);
    
    // Update database
    await supabase
      .from('pattern_licenses')
      .update({
        usage_this_month: license.usageThisMonth,
        last_used_at: license.lastUsedAt
      })
      .eq('id', license.id);
    
    // Store usage event
    await supabase
      .from('pattern_usage_events')
      .insert({
        license_id: event.licenseId,
        endpoint: event.endpoint,
        pattern: event.pattern,
        sport: event.sport,
        timestamp: event.timestamp,
        response_time: event.responseTime,
        success: event.success,
        error: event.error
      });
  }
  
  async getUsageStats(licenseId: string): Promise<{
    currentMonth: {
      used: number;
      limit: number;
      percentUsed: number;
    };
    byEndpoint: Record<string, number>;
    byPattern: Record<string, number>;
    bySport: Record<string, number>;
    avgResponseTime: number;
    successRate: number;
  }> {
    const license = Array.from(this.licenses.values()).find(l => l.id === licenseId);
    if (!license) throw new Error('License not found');
    
    const events = this.usageEvents.filter(e => e.licenseId === licenseId);
    
    const byEndpoint: Record<string, number> = {};
    const byPattern: Record<string, number> = {};
    const bySport: Record<string, number> = {};
    
    let totalResponseTime = 0;
    let successCount = 0;
    
    events.forEach(event => {
      byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;
      if (event.pattern) {
        byPattern[event.pattern] = (byPattern[event.pattern] || 0) + 1;
      }
      if (event.sport) {
        bySport[event.sport] = (bySport[event.sport] || 0) + 1;
      }
      totalResponseTime += event.responseTime;
      if (event.success) successCount++;
    });
    
    return {
      currentMonth: {
        used: license.usageThisMonth,
        limit: license.limitThisMonth,
        percentUsed: (license.usageThisMonth / license.limitThisMonth) * 100
      },
      byEndpoint,
      byPattern,
      bySport,
      avgResponseTime: events.length > 0 ? totalResponseTime / events.length : 0,
      successRate: events.length > 0 ? (successCount / events.length) * 100 : 100
    };
  }
  
  private startUsageMonitoring() {
    // Reset monthly usage at the start of each month
    setInterval(async () => {
      const now = new Date();
      if (now.getDate() === 1 && now.getHours() === 0) {
        console.log(chalk.yellow('🔄 Resetting monthly usage counts...'));
        
        for (const license of this.licenses.values()) {
          license.usageThisMonth = 0;
          await supabase
            .from('pattern_licenses')
            .update({ usage_this_month: 0 })
            .eq('id', license.id);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
    
    // Clean up old usage events
    setInterval(async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.usageEvents = this.usageEvents.filter(e => e.timestamp > thirtyDaysAgo);
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
  
  async createCheckoutSession(
    userId: string,
    tierId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const tier = this.tiers.find(t => t.id === tierId);
    if (!tier || !tier.stripePriceId) {
      throw new Error('Invalid tier or no price configured');
    }
    
    // In production, would create real Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: tier.stripePriceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tierId
      }
    });
    
    return session.url || '';
  }
}

// Initialize platform
const platform = new PatternLicensingPlatform();

// API endpoints
app.get('/tiers', (req, res) => {
  res.json({
    success: true,
    tiers: platform['tiers']
  });
});

app.post('/licenses', async (req, res) => {
  try {
    const { userId, tierId, metadata } = req.body;
    
    const license = await platform.createLicense(userId, tierId, metadata);
    
    res.json({
      success: true,
      license: {
        id: license.id,
        apiKey: license.apiKey,
        secretKey: license.secretKey,
        tier: tierId,
        expiresAt: license.expiresAt
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/licenses/:apiKey/validate', async (req, res) => {
  const { apiKey } = req.params;
  const secretKey = req.headers['x-secret-key'] as string;
  
  const validation = await platform.validateApiKey(apiKey, secretKey);
  
  res.json({
    success: validation.valid,
    tier: validation.tier,
    reason: validation.reason
  });
});

app.get('/licenses/:id/usage', async (req, res) => {
  try {
    const stats = await platform.getUsageStats(req.params.id);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/checkout', async (req, res) => {
  try {
    const { userId, tierId, successUrl, cancelUrl } = req.body;
    
    const checkoutUrl = await platform.createCheckoutSession(
      userId,
      tierId,
      successUrl,
      cancelUrl
    );
    
    res.json({ success: true, checkoutUrl });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware to validate API keys for pattern endpoints
export async function validateLicense(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string;
  const secretKey = req.headers['x-secret-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  const validation = await platform.validateApiKey(apiKey, secretKey);
  
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.reason
    });
  }
  
  // Check feature access
  const endpoint = req.path;
  const sport = req.query.sport || req.body.sport;
  const pattern = req.query.pattern || req.body.pattern;
  
  if (sport && validation.tier!.features.sports[0] !== 'all' && 
      !validation.tier!.features.sports.includes(sport)) {
    return res.status(403).json({
      success: false,
      error: `Sport ${sport} not available in ${validation.tier!.name} tier`
    });
  }
  
  if (pattern && validation.tier!.features.patterns[0] !== 'all' && 
      !validation.tier!.features.patterns.includes(pattern)) {
    return res.status(403).json({
      success: false,
      error: `Pattern ${pattern} not available in ${validation.tier!.name} tier`
    });
  }
  
  // Track usage
  const startTime = Date.now();
  
  res.on('finish', async () => {
    await platform.trackUsage(apiKey, endpoint, {
      pattern,
      sport,
      responseTime: Date.now() - startTime,
      success: res.statusCode < 400,
      error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
    });
  });
  
  req.license = validation.license;
  req.tier = validation.tier;
  
  next();
}

// Start server
app.listen(PORT, async () => {
  console.log(chalk.green(`\n💎 PATTERN LICENSING PLATFORM RUNNING!`));
  console.log(chalk.white(`Port: ${PORT}`));
  console.log(chalk.cyan(`\nLicense Tiers:`));
  
  platform['tiers'].forEach(tier => {
    console.log(`\n${chalk.yellow(tier.name)} - $${tier.price}/month`);
    console.log(`  API Calls: ${tier.features.apiCallsPerMonth.toLocaleString()}`);
    console.log(`  Patterns: ${tier.features.patterns.join(', ')}`);
    console.log(`  Sports: ${tier.features.sports.join(', ')}`);
    console.log(`  Real-time: ${tier.features.realTimeAccess ? '✅' : '❌'}`);
    console.log(`  Support: ${tier.features.support}`);
  });
  
  await platform.initialize();
  
  // Create demo license
  console.log(chalk.cyan('\n📝 Creating demo license...'));
  const demoLicense = await platform.createLicense('demo_user', 'free', {
    company: 'Demo Company',
    useCase: 'Testing'
  });
  
  console.log(chalk.white('\nDemo API Key:'), chalk.green(demoLicense.apiKey));
  console.log(chalk.white('Demo Secret:'), chalk.gray(demoLicense.secretKey));
});

export { PatternLicensingPlatform };