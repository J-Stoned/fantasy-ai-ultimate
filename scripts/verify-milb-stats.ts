import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyMiLBStats() {
  console.log(chalk.cyan('🔍 Verifying MiLB Stats Collection\n'));
  
  // Check players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`MiLB Players: ${playerCount || 0}`));
  
  // Check stats
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`MiLB Stats: ${statsCount || 0}`));
  
  // Sample some players
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('name, team_id, position, external_id')
    .eq('sport', 'MILB')
    .limit(5);
    
  if (samplePlayers && samplePlayers.length > 0) {
    console.log(chalk.green('\nSample MiLB Players:'));
    samplePlayers.forEach(p => {
      console.log(`  ${p.name} - Team ${p.team_id} - ${p.position} - ${p.external_id}`);
    });
  }
  
  // Sample some stats
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('player_id, game_date, stats')
    .eq('sport', 'MILB')
    .limit(3);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.green('\nSample MiLB Stats:'));
    sampleStats.forEach((s, i) => {
      console.log(`\nStat ${i + 1}:`);
      console.log(`  Player: ${s.player_id}`);
      console.log(`  Date: ${new Date(s.game_date).toLocaleDateString()}`);
      if (s.stats?.atBats !== undefined) {
        console.log(`  AB: ${s.stats.atBats}, H: ${s.stats.hits}, R: ${s.stats.runs}, RBI: ${s.stats.rbi}`);
      }
      if (s.stats?.inningsPitched) {
        console.log(`  IP: ${s.stats.inningsPitched}, ER: ${s.stats.earnedRuns}, K: ${s.stats.strikeOuts}`);
      }
    });
  }
  
  // Check for errors
  const { data: playersWithNullTeam } = await supabase
    .from('players')
    .select('count')
    .eq('sport', 'MILB')
    .is('team_id', null)
    .limit(1);
    
  if (playersWithNullTeam && playersWithNullTeam.length > 0) {
    console.log(chalk.red(`\n⚠️  Players with null team_id found`));
  }
}

verifyMiLBStats().catch(console.error);