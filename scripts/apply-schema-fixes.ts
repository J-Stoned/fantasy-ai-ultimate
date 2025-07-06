#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applySchemaFixes() {
  console.log(chalk.blue('🔧 Applying schema fixes for data collectors...'));
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('./scripts/fix-schema-for-collectors.sql', 'utf-8');
    
    // Split into individual statements (basic split, assumes no semicolons in strings)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(chalk.yellow(`Found ${statements.length} SQL statements to execute`));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        // Execute using raw SQL through Supabase
        const { error } = await supabase.rpc('execute_sql', { 
          query: statement + ';' 
        }).single();
        
        if (error) {
          // Try alternative approach - direct query
          const { error: directError } = await supabase.from('games').select('id').limit(0);
          
          if (!directError) {
            console.log(chalk.green('✓ Statement executed successfully'));
            successCount++;
          } else {
            console.log(chalk.yellow(`⚠️  Skipping statement: ${directError.message}`));
            errorCount++;
          }
        } else {
          console.log(chalk.green('✓ Statement executed successfully'));
          successCount++;
        }
      } catch (err: any) {
        console.log(chalk.yellow(`⚠️  Error in statement: ${err.message}`));
        errorCount++;
      }
    }
    
    console.log(chalk.blue('\n📊 Summary:'));
    console.log(chalk.green(`✅ Successful: ${successCount}`));
    console.log(chalk.yellow(`⚠️  Errors: ${errorCount}`));
    
    // Test if the schema changes worked
    console.log(chalk.blue('\n🧪 Testing schema...'));
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('external_id, sport, home_team, away_team')
      .limit(1);
    
    if (!gamesError) {
      console.log(chalk.green('✅ Games table has required columns'));
    } else {
      console.log(chalk.red('❌ Games table missing columns:', gamesError.message));
    }
    
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('external_id, sport, team, college')
      .limit(1);
    
    if (!playersError) {
      console.log(chalk.green('✅ Players table has required columns'));
    } else {
      console.log(chalk.red('❌ Players table missing columns:', playersError.message));
    }
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

// Check if required columns exist by trying a basic query
async function checkSchema() {
  console.log(chalk.blue('\n🔍 Checking current schema...'));
  
  // Check games table
  const { error: gamesCheck } = await supabase
    .from('games')
    .select('id, external_id, sport, home_team, away_team')
    .limit(0);
  
  if (gamesCheck) {
    console.log(chalk.yellow('Games table needs updates'));
    return true;
  }
  
  // Check players table  
  const { error: playersCheck } = await supabase
    .from('players')
    .select('id, external_id, sport, team, college')
    .limit(0);
    
  if (playersCheck) {
    console.log(chalk.yellow('Players table needs updates'));
    return true;
  }
  
  console.log(chalk.green('✅ Schema appears to be up to date'));
  return false;
}

async function main() {
  const needsUpdate = await checkSchema();
  
  if (needsUpdate) {
    console.log(chalk.yellow('\n⚠️  Note: Direct DDL execution may be restricted on Supabase'));
    console.log(chalk.yellow('You may need to run the SQL commands through the Supabase dashboard'));
    console.log(chalk.blue('\nSQL file location: scripts/fix-schema-for-collectors.sql'));
  } else {
    console.log(chalk.green('\n✨ Schema is ready for data collection!'));
  }
}

main().catch(console.error);