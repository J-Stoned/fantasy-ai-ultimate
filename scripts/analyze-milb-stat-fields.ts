import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatFields() {
  console.log(chalk.cyan('🔍 Analyzing MiLB Stat Fields\n'));
  
  // Get a sample game
  const { data: games } = await supabase
    .from('games')
    .select('external_id')
    .eq('sport', 'MILB')
    .limit(1);
    
  if (!games || games.length === 0) {
    console.log('No MiLB games found');
    return;
  }
  
  const gameId = games[0].external_id.replace('mlb_milb_', '');
  console.log(chalk.yellow(`Checking game ${gameId}...\n`));
  
  try {
    const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`);
    const boxscore = response.data;
    
    // Find a player with batting stats
    let battingFields: string[] = [];
    let pitchingFields: string[] = [];
    
    for (const side of ['away', 'home']) {
      const players = boxscore.teams[side].players;
      
      for (const playerId in players) {
        const player = players[playerId];
        
        if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
          battingFields = Object.keys(player.stats.batting);
        }
        
        if (player.stats?.pitching && Object.keys(player.stats.pitching).length > 0) {
          pitchingFields = Object.keys(player.stats.pitching);
        }
        
        if (battingFields.length > 0 && pitchingFields.length > 0) break;
      }
      if (battingFields.length > 0 && pitchingFields.length > 0) break;
    }
    
    console.log(chalk.green('📊 Available Batting Stats in API:'));
    console.log(chalk.yellow(`Total: ${battingFields.length} fields`));
    console.log(battingFields.sort());
    
    console.log(chalk.green('\n📊 Available Pitching Stats in API:'));
    console.log(chalk.yellow(`Total: ${pitchingFields.length} fields`));
    console.log(pitchingFields.sort());
    
    // Now check what we're actually collecting
    console.log(chalk.cyan('\n🔍 What We\'re Currently Collecting:\n'));
    
    console.log(chalk.yellow('Batting Stats (15 fields):'));
    const collectedBatting = [
      'atBats', 'runs', 'hits', 'doubles', 'triples', 'homeRuns', 
      'rbi', 'baseOnBalls', 'strikeOuts', 'stolenBases', 'caughtStealing',
      'avg', 'obp', 'slg', 'ops'
    ];
    console.log(collectedBatting);
    
    console.log(chalk.yellow('\nPitching Stats (18 fields):'));
    const collectedPitching = [
      'inningsPitched', 'hits', 'runs', 'earnedRuns', 'baseOnBalls',
      'strikeOuts', 'homeRuns', 'era', 'whip', 'pitchesThrown',
      'strikes', 'balls', 'win', 'loss', 'save', 'blownSave', 'hold'
    ];
    console.log(collectedPitching);
    
    // Find missing fields
    const missingBatting = battingFields.filter(f => !collectedBatting.includes(f));
    const missingPitching = pitchingFields.filter(f => !collectedPitching.includes(f));
    
    console.log(chalk.red('\n❌ Missing Batting Fields:'));
    console.log(missingBatting);
    
    console.log(chalk.red('\n❌ Missing Pitching Fields:'));
    console.log(missingPitching);
    
    // Calculate coverage
    const battingCoverage = Math.round((collectedBatting.length / battingFields.length) * 100);
    const pitchingCoverage = Math.round((collectedPitching.length / pitchingFields.length) * 100);
    
    console.log(chalk.cyan('\n📈 Coverage Summary:'));
    console.log(`Batting: ${collectedBatting.length}/${battingFields.length} fields (${battingCoverage}%)`);
    console.log(`Pitching: ${collectedPitching.length}/${pitchingFields.length} fields (${pitchingCoverage}%)`);
    
    // Estimate total stats if we collected all fields
    const currentAvgFields = (15 + 18) / 2; // 16.5
    const totalAvgFields = (battingFields.length + pitchingFields.length) / 2;
    const expansionFactor = totalAvgFields / currentAvgFields;
    const estimatedStats = Math.round(22511 * expansionFactor);
    
    console.log(chalk.yellow(`\n💡 If we collected ALL fields:`));
    console.log(`Current: 22,511 stats with ~33 fields`);
    console.log(`Potential: ~${estimatedStats.toLocaleString()} stats with ~${Math.round(totalAvgFields * 2)} fields`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeStatFields().catch(console.error);