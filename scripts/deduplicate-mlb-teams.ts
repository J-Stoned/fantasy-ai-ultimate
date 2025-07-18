#!/usr/bin/env tsx
/**
 * MLB Team Deduplication Script
 * Finds and consolidates duplicate MLB teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deduplicateMLBTeams() {
  console.log(chalk.blue('⚾ MLB TEAM DEDUPLICATION'));
  console.log(chalk.blue('========================\n'));

  // Get all MLB teams
  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .eq('sport', 'MLB')
    .order('created_at');

  if (error || !teams) {
    console.error(chalk.red('Error fetching teams:'), error);
    return;
  }

  console.log(chalk.yellow(`Found ${teams.length} MLB teams total`));

  // Group by team name
  const teamGroups: Record<string, typeof teams> = {};
  teams.forEach(team => {
    const name = team.name.trim();
    if (!teamGroups[name]) {
      teamGroups[name] = [];
    }
    teamGroups[name].push(team);
  });

  // Find duplicates
  const duplicateGroups = Object.entries(teamGroups)
    .filter(([_, teams]) => teams.length > 1);

  console.log(chalk.yellow(`\nFound ${duplicateGroups.length} duplicate team names\n`));

  let totalDuplicates = 0;
  let playersTransferred = 0;
  let gamesUpdated = 0;

  for (const [teamName, duplicateTeams] of duplicateGroups) {
    console.log(chalk.cyan(`\nProcessing: ${teamName}`));
    
    // Sort by external_id to prioritize ESPN format
    const sorted = duplicateTeams.sort((a, b) => {
      const aHasESPN = a.external_id?.startsWith('espn_mlb_') ? 0 : 1;
      const bHasESPN = b.external_id?.startsWith('espn_mlb_') ? 0 : 1;
      return aHasESPN - bHasESPN;
    });

    const keepTeam = sorted[0];
    const duplicatesToRemove = sorted.slice(1);

    console.log(chalk.green(`  Keeping: ID ${keepTeam.id} (${keepTeam.external_id})`));
    
    for (const dupTeam of duplicatesToRemove) {
      console.log(chalk.red(`  Removing: ID ${dupTeam.id} (${dupTeam.external_id})`));
      
      // Transfer players
      const { data: players, error: playerError } = await supabase
        .from('players')
        .update({ team_id: keepTeam.id })
        .eq('team_id', dupTeam.id)
        .select();

      if (!playerError && players) {
        playersTransferred += players.length;
        console.log(chalk.gray(`    Transferred ${players.length} players`));
      }

      // Update games (home team)
      const { data: homeGames, error: homeError } = await supabase
        .from('games')
        .update({ home_team_id: keepTeam.id })
        .eq('home_team_id', dupTeam.id)
        .select();

      if (!homeError && homeGames) {
        gamesUpdated += homeGames.length;
        console.log(chalk.gray(`    Updated ${homeGames.length} home games`));
      }

      // Update games (away team)
      const { data: awayGames, error: awayError } = await supabase
        .from('games')
        .update({ away_team_id: keepTeam.id })
        .eq('away_team_id', dupTeam.id)
        .select();

      if (!awayError && awayGames) {
        gamesUpdated += awayGames.length;
        console.log(chalk.gray(`    Updated ${awayGames.length} away games`));
      }

      // Delete duplicate team
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', dupTeam.id);

      if (!deleteError) {
        totalDuplicates++;
        console.log(chalk.green(`    ✓ Deleted duplicate team`));
      } else {
        console.error(chalk.red(`    ✗ Error deleting team:`), deleteError);
      }
    }
  }

  // Final verification
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');

  console.log(chalk.blue('\n========================'));
  console.log(chalk.blue('DEDUPLICATION COMPLETE'));
  console.log(chalk.blue('========================'));
  console.log(chalk.green(`✓ Removed ${totalDuplicates} duplicate teams`));
  console.log(chalk.green(`✓ Transferred ${playersTransferred} players`));
  console.log(chalk.green(`✓ Updated ${gamesUpdated} games`));
  console.log(chalk.green(`✓ Final MLB team count: ${finalCount}`));
}

// Run the deduplication
deduplicateMLBTeams().catch(console.error);