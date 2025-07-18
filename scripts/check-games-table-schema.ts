import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesTableSchema() {
  console.log(chalk.cyan('🔍 Checking games table schema...\n'));
  
  try {
    // Get one game to see the columns
    const { data: sampleGame, error } = await supabase
      .from('games')
      .select('*')
      .limit(1)
      .single();
      
    if (error) {
      console.error(chalk.red('Error fetching sample game:'), error);
      return;
    }
    
    if (sampleGame) {
      console.log(chalk.yellow('Games table columns:'));
      Object.keys(sampleGame).forEach(column => {
        console.log(chalk.green(`  - ${column}: ${typeof sampleGame[column]}`));
      });
    }
    
    // Try to check if specific columns exist
    console.log(chalk.cyan('\n🔍 Checking for missing columns...'));
    
    const columnsToCheck = ['season', 'scheduled_innings', 'actual_innings', 'game_type', 'doubleheader'];
    
    for (const column of columnsToCheck) {
      try {
        const { data, error } = await supabase
          .from('games')
          .select(column)
          .limit(1);
          
        if (error) {
          console.log(chalk.red(`❌ Column '${column}' does not exist`));
        } else {
          console.log(chalk.green(`✅ Column '${column}' exists`));
        }
      } catch (e) {
        console.log(chalk.red(`❌ Column '${column}' does not exist`));
      }
    }
    
    // Check what sport values exist
    console.log(chalk.cyan('\n🔍 Checking sport values in games table...'));
    const { data: sports } = await supabase
      .from('games')
      .select('sport')
      .limit(100);
      
    const uniqueSports = new Set(sports?.map(g => g.sport));
    console.log(chalk.yellow('Unique sports:'), Array.from(uniqueSports));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

checkGamesTableSchema().catch(console.error);