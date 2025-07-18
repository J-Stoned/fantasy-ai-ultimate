import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkInsertIssues() {
  console.log(chalk.cyan('🔍 Checking MiLB Insert Issues\n'));
  
  // Try inserting a single test player
  const testPlayer = {
    external_id: 'mlb_milb_999999',
    name: 'Test Player',
    firstname: 'Test',
    lastname: 'Player',
    team_id: 1, // Use a valid team ID
    position: ['P'],
    jersey_number: null,
    sport: 'MILB',
    metadata: {}
  };
  
  console.log(chalk.yellow('Attempting test insert...'));
  
  const { data, error } = await supabase
    .from('players')
    .insert(testPlayer)
    .select();
    
  if (error) {
    console.error(chalk.red('Insert error:'), error);
  } else {
    console.log(chalk.green('Insert successful!'), data);
    
    // Clean up test
    await supabase
      .from('players')
      .delete()
      .eq('external_id', 'mlb_milb_999999');
  }
  
  // Check if there's a valid team
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('sport', 'MILB')
    .limit(5);
    
  console.log(chalk.yellow('\nSample MiLB team IDs:'));
  teams?.forEach(t => console.log(`  Team ${t.id}: ${t.name}`));
  
  // Check schema
  const { data: schemaCheck } = await supabase
    .from('players')
    .select('*')
    .limit(1);
    
  if (schemaCheck && schemaCheck.length > 0) {
    console.log(chalk.yellow('\nPlayers table columns:'));
    console.log(Object.keys(schemaCheck[0]));
  }
}

checkInsertIssues().catch(console.error);