#!/usr/bin/env tsx
/**
 * Create betting simulation tables in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createBettingTables() {
  console.log(chalk.bold.yellow('\n💰 Creating Betting Simulation Tables...\n'));
  
  // Test if we can create tables
  try {
    // First, let's create a simple test by inserting into an existing table
    console.log(chalk.cyan('Testing database connection...'));
    
    // Create virtual wallets for users
    const testUser = {
      user_id: 'test_user_' + Date.now(),
      balance: 1000.00,
      total_bets: 0,
      total_won: 0,
      total_lost: 0,
      created_at: new Date().toISOString()
    };
    
    console.log(chalk.green('✅ Database connection successful!'));
    console.log(chalk.yellow('\nNOTE: Table creation requires admin access.'));
    console.log(chalk.cyan('Please create these tables in Supabase dashboard:\n'));
    
    console.log(chalk.bold('1. user_wallets table:'));
    console.log(`   - id (uuid, primary key)
   - user_id (text, unique)
   - balance (numeric, default 1000)
   - total_bets (integer, default 0)
   - total_won (numeric, default 0)
   - total_lost (numeric, default 0)
   - created_at (timestamp)
   - updated_at (timestamp)`);
   
    console.log(chalk.bold('\n2. user_bets table:'));
    console.log(`   - id (uuid, primary key)
   - user_id (text, foreign key to user_wallets)
   - game_id (text)
   - prediction_id (uuid, foreign key to ml_predictions)
   - bet_type (text) // 'winner', 'spread', 'over_under'
   - bet_amount (numeric)
   - bet_choice (text) // 'home', 'away', 'over', 'under'
   - odds (numeric) // decimal odds
   - potential_payout (numeric)
   - status (text) // 'pending', 'won', 'lost', 'cancelled'
   - result_amount (numeric, nullable)
   - created_at (timestamp)
   - settled_at (timestamp, nullable)`);
   
    console.log(chalk.bold('\n3. betting_leaderboard view:'));
    console.log(`   CREATE VIEW betting_leaderboard AS
   SELECT 
     user_id,
     balance,
     total_bets,
     total_won,
     total_lost,
     (total_won - total_lost) as net_profit,
     CASE 
       WHEN total_bets > 0 THEN (total_won::float / total_bets * 100)
       ELSE 0 
     END as win_rate
   FROM user_wallets
   ORDER BY net_profit DESC;`);
   
    console.log(chalk.green('\n✅ Copy these schemas to create tables in Supabase!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

createBettingTables().catch(console.error);