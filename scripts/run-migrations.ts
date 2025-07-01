#!/usr/bin/env tsx
/**
 * Database Migration Script
 * Sets up all necessary tables for Fantasy AI Ultimate
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.blue.bold('\n🚀 Running Database Migrations...\n'));

async function runMigrations() {
  try {
    // 1. Create voice_commands table for training data
    console.log('📊 Creating voice_commands table...');
    const { error: voiceCommandsError } = await supabase.rpc('exec_sql', {
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_voice_commands_user_id ON voice_commands(user_id);
        CREATE INDEX IF NOT EXISTS idx_voice_commands_timestamp ON voice_commands(timestamp);
        CREATE INDEX IF NOT EXISTS idx_voice_commands_intent ON voice_commands(intent);
      `
    });

    if (voiceCommandsError) {
      console.error('Error creating voice_commands table:', voiceCommandsError);
    } else {
      console.log(chalk.green('✅ voice_commands table created'));
    }

    // 2. Create model_deployments table
    console.log('🤖 Creating model_deployments table...');
    const { error: modelDeploymentsError } = await supabase.rpc('exec_sql', {
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_model_deployments_version ON model_deployments(version);
        CREATE INDEX IF NOT EXISTS idx_model_deployments_deployed_at ON model_deployments(deployed_at);
      `
    });

    if (modelDeploymentsError) {
      console.error('Error creating model_deployments table:', modelDeploymentsError);
    } else {
      console.log(chalk.green('✅ model_deployments table created'));
    }

    // 3. Create training_metrics table
    console.log('📈 Creating training_metrics table...');
    const { error: trainingMetricsError } = await supabase.rpc('exec_sql', {
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_training_metrics_model_version ON training_metrics(model_version);
        CREATE INDEX IF NOT EXISTS idx_training_metrics_created_at ON training_metrics(created_at);
      `
    });

    if (trainingMetricsError) {
      console.error('Error creating training_metrics table:', trainingMetricsError);
    } else {
      console.log(chalk.green('✅ training_metrics table created'));
    }

    // 4. Create user_subscriptions table for Stripe
    console.log('💳 Creating user_subscriptions table...');
    const { error: subscriptionsError } = await supabase.rpc('exec_sql', {
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
      `
    });

    if (subscriptionsError) {
      console.error('Error creating user_subscriptions table:', subscriptionsError);
    } else {
      console.log(chalk.green('✅ user_subscriptions table created'));
    }

    // 5. Create payment_history table
    console.log('💰 Creating payment_history table...');
    const { error: paymentHistoryError } = await supabase.rpc('exec_sql', {
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON payment_history(created_at);
      `
    });

    if (paymentHistoryError) {
      console.error('Error creating payment_history table:', paymentHistoryError);
    } else {
      console.log(chalk.green('✅ payment_history table created'));
    }

    // 6. Enable Row Level Security
    console.log('🔒 Enabling Row Level Security...');
    const tables = ['voice_commands', 'model_deployments', 'training_metrics', 'user_subscriptions', 'payment_history'];
    
    for (const table of tables) {
      const { error: rlsError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
      });
      
      if (rlsError) {
        console.error(`Error enabling RLS for ${table}:`, rlsError);
      } else {
        console.log(chalk.green(`✅ RLS enabled for ${table}`));
      }
    }

    // 7. Create RLS policies
    console.log('📜 Creating RLS policies...');
    
    // Voice commands - users can only see their own
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view own voice commands" ON voice_commands
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert own voice commands" ON voice_commands
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update own voice commands" ON voice_commands
          FOR UPDATE USING (auth.uid() = user_id);
      `
    });

    // Subscriptions - users can only see their own
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view own subscription" ON user_subscriptions
          FOR SELECT USING (auth.uid() = user_id);
      `
    });

    // Payment history - users can only see their own
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view own payment history" ON payment_history
          FOR SELECT USING (auth.uid() = user_id);
      `
    });

    console.log(chalk.green('✅ All RLS policies created'));

    console.log(chalk.green.bold('\n🎉 Migrations completed successfully!\n'));

  } catch (error) {
    console.error(chalk.red('Migration error:'), error);
    process.exit(1);
  }
}

// Check if exec_sql function exists, if not create it
async function createExecSqlFunction() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    
    if (error) {
      console.log('Creating exec_sql function...');
      // This would need to be run directly in Supabase SQL editor
      console.log(chalk.yellow(`
⚠️  Please run this in your Supabase SQL editor first:

CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
      `));
      
      console.log(chalk.yellow('\n❌ Migration requires exec_sql function. Please create it first.'));
      process.exit(1);
    }
  } catch (err) {
    // Function doesn't exist, show instructions
    console.log(chalk.yellow('\n⚠️  Database migrations require the exec_sql function.'));
    console.log(chalk.yellow('Please run this in your Supabase SQL editor first:\n'));
    console.log(chalk.cyan(`CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;`));
    console.log(chalk.yellow('\nThen run migrations again: npm run migrate'));
    process.exit(1);
  }
}

// Run migrations
async function main() {
  await createExecSqlFunction();
  await runMigrations();
}

main().catch(console.error);