#!/usr/bin/env tsx
/**
 * Fix NFL data categorization issues:
 * - Update sport from "football" to "nfl" 
 * - Fix team sport assignments
 * - Fix player-team relationships
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNFLData() {
  console.log(chalk.bold.cyan('\n🔧 FIXING NFL DATA CATEGORIZATION\n'));

  try {
    // Step 1: Update all "football" players to "nfl"
    console.log('Step 1: Updating player sports from "football" to "nfl"...');
    const { data: footballPlayers, error: playerError } = await supabase
      .from('players')
      .update({ sport: 'nfl' })
      .eq('sport', 'football')
      .select();
    
    if (!playerError) {
      console.log(chalk.green(`✓ Updated ${footballPlayers?.length || 0} players to sport="nfl"`));
    } else {
      console.error(chalk.red('Error updating players:'), playerError);
    }

    // Step 2: Identify and tag NFL teams
    console.log('\nStep 2: Identifying NFL teams...');
    const nflTeamNames = [
      'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
      'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
      'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
      'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
      'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
      'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
      'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
      'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
      // Also check for variations
      'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Panthers', 'Bears', 'Bengals', 'Browns',
      'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Chiefs',
      'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Saints', 'Giants',
      'Jets', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers', 'Titans', 'Commanders',
      'Washington Football Team', 'Redskins'
    ];

    let nflTeamsUpdated = 0;
    for (const teamName of nflTeamNames) {
      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .update({ sport: 'nfl' })
        .ilike('name', `%${teamName}%`)
        .select();
      
      if (!teamError && teams && teams.length > 0) {
        nflTeamsUpdated += teams.length;
      }
    }
    
    console.log(chalk.green(`✓ Updated ${nflTeamsUpdated} teams to sport="nfl"`));

    // Step 3: Fix games with sport_id="nfl" but sport=null
    console.log('\nStep 3: Fixing game sport fields...');
    const { data: nflGames, error: gameError } = await supabase
      .from('games')
      .update({ sport: 'nfl' })
      .eq('sport_id', 'nfl')
      .is('sport', null)
      .select();
    
    if (!gameError) {
      console.log(chalk.green(`✓ Updated ${nflGames?.length || 0} games to sport="nfl"`));
    }

    // Step 4: Update the ultimate collector's player cache loading
    console.log('\nStep 4: Checking player totals...');
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { count: nflPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'nfl');
    
    console.log(chalk.yellow(`Total players: ${totalPlayers}`));
    console.log(chalk.yellow(`NFL players: ${nflPlayers}`));

    // Step 5: Fix player-team relationships (this is complex, may need manual intervention)
    console.log('\nStep 5: Analyzing player-team relationships...');
    const { data: mislinkedPlayers, error: linkError } = await supabase
      .from('players')
      .select('id, name, team_id, teams!inner(name, sport)')
      .eq('sport', 'nfl')
      .neq('teams.sport', 'nfl')
      .limit(10);
    
    if (!linkError && mislinkedPlayers && mislinkedPlayers.length > 0) {
      console.log(chalk.yellow(`Found ${mislinkedPlayers.length} NFL players linked to non-NFL teams:`));
      mislinkedPlayers.forEach(p => {
        console.log(`  - ${p.name} → ${p.teams?.name} (${p.teams?.sport})`);
      });
      console.log(chalk.yellow('These need manual fixing or a more complex matching algorithm'));
    }

    console.log(chalk.bold.green('\n✅ NFL data categorization fixes complete!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Update ultimate-stats-collector-v2.ts to remove the 1000 player limit');
    console.log('2. Re-run the stats collector with proper player matching');
    console.log('3. Verify all NFL games get 40-60 player stats each');

  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

fixNFLData();