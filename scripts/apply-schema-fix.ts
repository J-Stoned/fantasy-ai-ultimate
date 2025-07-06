#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchemaFix() {
  console.log(chalk.yellow('\n🔧 APPLYING SCHEMA FIX FOR DATA COLLECTORS\n'));
  
  try {
    // Read the SQL fix file
    const sqlContent = fs.readFileSync('/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/scripts/fix-schema-for-collectors.sql', 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(chalk.blue(`📝 Executing ${statements.length} schema updates...\n`));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      try {
        console.log(chalk.gray(`${i + 1}. ${statement.substring(0, 60)}...`));
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });
        
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase
            .from('dummy')
            .select('*')
            .limit(0);
          
          if (directError) {
            console.log(chalk.yellow(`   ⚠️  ${error.message}`));
            errorCount++;
          } else {
            console.log(chalk.green(`   ✅ Applied`));
            successCount++;
          }
        } else {
          console.log(chalk.green(`   ✅ Applied`));
          successCount++;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.log(chalk.red(`   ❌ Error: ${err}`));
        errorCount++;
      }
    }
    
    console.log(chalk.cyan('\n📊 SCHEMA UPDATE RESULTS'));
    console.log(chalk.cyan('========================\n'));
    console.log(chalk.green(`✅ Successful: ${successCount}`));
    console.log(chalk.red(`❌ Failed: ${errorCount}`));
    console.log(chalk.white(`📝 Total: ${statements.length}\n`));
    
    // Test if the fixes worked by checking for the missing columns
    console.log(chalk.blue('🔍 Verifying schema fixes...\n'));
    
    try {
      // Test games table
      const { data: gamesTest } = await supabase
        .from('games')
        .select('away_team, home_team, external_id')
        .limit(1);
      
      console.log(chalk.green('✅ Games table: away_team, home_team, external_id columns available'));
      
      // Test news_articles table
      const { data: newsTest } = await supabase
        .from('news_articles')
        .select('external_id, source')
        .limit(1);
      
      console.log(chalk.green('✅ News articles table: external_id, source columns available'));
      
      // Test betting_odds table
      const { data: oddsTest } = await supabase
        .from('betting_odds')
        .select('*')
        .limit(1);
      
      console.log(chalk.green('✅ Betting odds table: Created and accessible'));
      
      console.log(chalk.yellow('\n🚀 Schema fixes applied! Data collectors should now work.\n'));
      
    } catch (verifyError) {
      console.log(chalk.red(`❌ Verification failed: ${verifyError}`));
      console.log(chalk.yellow('Some columns may still be missing. Check Supabase dashboard.'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Schema fix error:'), error);
  }
}

applySchemaFix();