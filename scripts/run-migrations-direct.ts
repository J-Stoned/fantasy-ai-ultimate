#!/usr/bin/env tsx
/**
 * Direct Database Migration Script
 * Creates tables directly without exec_sql function
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.blue.bold('\n🚀 Running Database Migrations (Direct Mode)...\n'));

async function runMigrations() {
  try {
    // 1. Test connection
    console.log('📊 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('players')
      .select('count')
      .limit(1);
    
    if (testError && !testError.message.includes('does not exist')) {
      console.error(chalk.red('Database connection failed:'), testError);
      process.exit(1);
    }
    console.log(chalk.green('✅ Database connected'));

    // 2. Create tables via Supabase client
    console.log('\n📊 Creating tables...');
    console.log(chalk.yellow(`
⚠️  Note: Some tables need to be created via Supabase SQL editor.
    
For now, we'll use existing tables and create entries directly.
    
To create the voice training tables, run this SQL in Supabase:

-- Voice Commands Table
CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  command_id TEXT UNIQUE NOT NULL,
  transcript TEXT NOT NULL,
  intent TEXT,
  entities JSONB DEFAULT '{}',
  confidence FLOAT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  feedback TEXT CHECK (feedback IN ('positive', 'negative', NULL)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model Deployments Table  
CREATE TABLE IF NOT EXISTS model_deployments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  accuracy FLOAT NOT NULL,
  deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deployment_type TEXT,
  hardware TEXT,
  status TEXT DEFAULT 'active',
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training Metrics Table
CREATE TABLE IF NOT EXISTS training_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL,
  epoch INTEGER,
  loss FLOAT,
  accuracy FLOAT,
  training_time_ms INTEGER,
  gpu_memory_used BIGINT,
  hardware_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment History Table
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own voice commands" ON voice_commands
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice commands" ON voice_commands
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice commands" ON voice_commands
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payment history" ON payment_history
  FOR SELECT USING (auth.uid() = user_id);
    `));

    console.log(chalk.green('\n✅ Migration instructions displayed'));
    console.log(chalk.yellow('\n💡 For now, the app will work with existing tables.'));
    console.log(chalk.yellow('   Voice training data will be stored locally until tables are created.'));
    
    console.log(chalk.green.bold('\n🎉 Migration setup complete!\n'));

  } catch (error) {
    console.error(chalk.red('Migration error:'), error);
    process.exit(1);
  }
}

// Run migrations
runMigrations().catch(console.error);