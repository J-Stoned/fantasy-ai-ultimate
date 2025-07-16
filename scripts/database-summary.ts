#!/usr/bin/env node

/**
 * 📊 Complete Database Summary
 * Shows all data in our database organized by sport
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function databaseSummary() {
  console.log(chalk.bold.cyan('\n════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('       📊 FANTASY AI DATABASE SUMMARY 📊        '));
  console.log(chalk.bold.cyan('════════════════════════════════════════════════\n'));
  
  try {
    // Get all teams grouped by sport
    const { data: teams } = await supabase
      .from('teams')
      .select('name, sport, sport_id, abbreviation')
      .order('name');
    
    // Group teams by sport
    const teamsBySport: any = {};
    teams?.forEach(team => {
      const sport = team.sport || team.sport_id || 'Unknown';
      if (!teamsBySport[sport]) {
        teamsBySport[sport] = [];
      }
      teamsBySport[sport].push(team);
    });
    
    // Get all players grouped by sport
    const { data: players } = await supabase
      .from('players')
      .select('name, sport, sport_id, team')
      .order('name');
    
    // Group players by sport
    const playersBySport: any = {};
    players?.forEach(player => {
      const sport = player.sport || player.sport_id || 'Unknown';
      if (!playersBySport[sport]) {
        playersBySport[sport] = 0;
      }
      playersBySport[sport]++;
    });
    
    // Display by sport
    const sports = ['baseball', 'basketball', 'football', 'hockey', 'MLB', 'NBA', 'NFL', 'NHL'];
    
    for (const sport of sports) {
      const sportTeams = teamsBySport[sport] || [];
      const sportPlayers = playersBySport[sport] || 0;
      
      if (sportTeams.length > 0 || sportPlayers > 0) {
        console.log(chalk.bold.yellow(`\n${sport.toUpperCase()}`));
        console.log(chalk.gray('─'.repeat(40)));
        
        if (sportTeams.length > 0) {
          console.log(chalk.cyan(`Teams (${sportTeams.length}):`));
          const teamsToShow = sportTeams.slice(0, 5);
          teamsToShow.forEach((team: any) => {
            console.log(chalk.gray(`  • ${team.name} (${team.abbreviation || 'N/A'})`));
          });
          if (sportTeams.length > 5) {
            console.log(chalk.gray(`  ... and ${sportTeams.length - 5} more teams`));
          }
        }
        
        if (sportPlayers > 0) {
          console.log(chalk.cyan(`Players: ${sportPlayers}`));
        }
      }
    }
    
    // Check for games and stats
    console.log(chalk.bold.yellow('\n\nGAME DATA'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.cyan(`Total Games in Database: ${totalGames || 0}`));
    console.log(chalk.cyan(`Total Player Stats: ${totalStats || 0}`));
    
    // Summary
    console.log(chalk.bold.green('\n\n📈 OVERALL SUMMARY'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const { count: totalTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.green(`Total Teams: ${totalTeams?.toLocaleString() || 0}`));
    console.log(chalk.green(`Total Players: ${totalPlayers?.toLocaleString() || 0}`));
    console.log(chalk.green(`Total Games: ${totalGames?.toLocaleString() || 0}`));
    console.log(chalk.green(`Total Stats: ${totalStats?.toLocaleString() || 0}`));
    
    // What's missing
    console.log(chalk.bold.red('\n\n⚠️  WHAT\'S MISSING'));
    console.log(chalk.gray('─'.repeat(40)));
    
    if (!totalGames || totalGames === 0) {
      console.log(chalk.red('• No games data collected yet'));
    }
    if (!totalStats || totalStats === 0) {
      console.log(chalk.red('• No player statistics collected yet'));
    }
    
    const { count: injuries } = await supabase
      .from('player_injuries')
      .select('*', { count: 'exact', head: true });
    
    if (!injuries || injuries === 0) {
      console.log(chalk.red('• No injury data collected yet'));
    }
    
    // Next steps
    console.log(chalk.bold.blue('\n\n🚀 NEXT STEPS'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.blue('1. Collect game data for each sport'));
    console.log(chalk.blue('2. Collect player statistics for games'));
    console.log(chalk.blue('3. Set up injury tracking'));
    console.log(chalk.blue('4. Add weather data for outdoor sports'));
    console.log(chalk.blue('5. Import betting lines and odds'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
  
  console.log(chalk.cyan('\n════════════════════════════════════════════════\n'));
}

databaseSummary().catch(console.error);