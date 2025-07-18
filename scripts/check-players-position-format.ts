import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPositionFormat() {
  console.log(chalk.cyan('Checking position format in players table...\n'));
  
  // Get sample players from different sports
  const { data: players } = await supabase
    .from('players')
    .select('id, name, position, sport')
    .in('sport', ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_HKY'])
    .limit(20);
    
  if (players) {
    console.log('Sample players and their positions:');
    players.forEach(player => {
      console.log(`${player.sport}: ${player.name} - Position: ${JSON.stringify(player.position)} (Type: ${typeof player.position})`);
    });
  }
}

checkPositionFormat()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });