#!/usr/bin/env tsx
/**
 * 📊 COMPREHENSIVE DATABASE CHECK
 * Summary of all data collected across all sports
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SportSummary {
  sport: string;
  teams: number;
  players: number;
  gamesWithScores: number;
  totalGames: number;
}

async function comprehensiveDatabaseCheck() {
  console.log(chalk.bold.blue('\n📊 COMPREHENSIVE DATABASE CHECK\n'));
  console.log(chalk.gray('After running all collectors...\n'));
  
  // Get total counts first
  const { count: totalTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('📈 OVERALL TOTALS:'));
  console.log(chalk.white(`   Teams: ${totalTeams?.toLocaleString()}`));
  console.log(chalk.white(`   Players: ${totalPlayers?.toLocaleString()}`));
  console.log(chalk.white(`   Games: ${totalGames?.toLocaleString()}\n`));
  
  // Get breakdown by sport
  const sports = ['nba', 'nfl', 'mlb', 'nhl', 'ncaa_football', 'ncaa_basketball', 'ncaa_baseball'];
  const summaries: SportSummary[] = [];
  
  console.log(chalk.yellow('🏆 BREAKDOWN BY SPORT:\n'));
  
  for (const sport of sports) {
    // Teams
    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    // Players
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    // Games with scores
    const { count: gamesWithScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    // Total games
    const { count: totalGameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    summaries.push({
      sport,
      teams: teamCount || 0,
      players: playerCount || 0,
      gamesWithScores: gamesWithScores || 0,
      totalGames: totalGameCount || 0
    });
  }
  
  // Display summaries
  summaries.forEach(summary => {
    if (summary.teams > 0 || summary.players > 0) {
      console.log(chalk.cyan(`${summary.sport.toUpperCase()}:`));
      console.log(chalk.white(`   Teams: ${summary.teams}`));
      console.log(chalk.white(`   Players: ${summary.players.toLocaleString()}`));
      if (summary.totalGames > 0) {
        console.log(chalk.white(`   Games: ${summary.totalGames.toLocaleString()} (${summary.gamesWithScores.toLocaleString()} with scores)`));
      }
      console.log();
    }
  });
  
  // Check for any issues
  console.log(chalk.yellow('🔍 DATA QUALITY CHECKS:\n'));
  
  // Players without teams
  const { count: playersNoTeam } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('team_id', null);
  
  console.log(chalk.white(`Players without team_id: ${playersNoTeam || 0}`));
  
  // Teams without players
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, sport_id');
  
  let teamsWithoutPlayers = 0;
  if (allTeams) {
    for (const team of allTeams) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);
      
      if (!count || count === 0) {
        teamsWithoutPlayers++;
      }
    }
  }
  
  console.log(chalk.white(`Teams without players: ${teamsWithoutPlayers}`));
  
  // Check for duplicate teams
  console.log(chalk.yellow('\n🔄 DUPLICATE CHECK:\n'));
  
  const duplicateSports = ['nba', 'nfl', 'mlb', 'nhl'];
  for (const sport of duplicateSports) {
    const { data: sportTeams } = await supabase
      .from('teams')
      .select('name')
      .eq('sport_id', sport)
      .order('name');
    
    if (sportTeams) {
      const nameCount: { [key: string]: number } = {};
      sportTeams.forEach(team => {
        nameCount[team.name] = (nameCount[team.name] || 0) + 1;
      });
      
      const duplicates = Object.entries(nameCount).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        console.log(chalk.red(`${sport.toUpperCase()} has duplicate teams:`));
        duplicates.forEach(([name, count]) => {
          console.log(chalk.red(`   ${name}: ${count} copies`));
        });
      } else {
        console.log(chalk.green(`${sport.toUpperCase()}: ✓ No duplicates`));
      }
    }
  }
  
  // Recent activity
  console.log(chalk.yellow('\n📅 RECENT COLLECTION ACTIVITY:\n'));
  
  const { data: recentPlayers } = await supabase
    .from('players')
    .select('sport_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (recentPlayers) {
    const today = new Date().toDateString();
    const todaysPlayers = recentPlayers.filter(p => 
      new Date(p.created_at).toDateString() === today
    );
    
    console.log(chalk.white(`Players added today: ${todaysPlayers.length}`));
    
    // Count by sport
    const bySport: { [key: string]: number } = {};
    todaysPlayers.forEach(p => {
      bySport[p.sport_id] = (bySport[p.sport_id] || 0) + 1;
    });
    
    Object.entries(bySport).forEach(([sport, count]) => {
      console.log(chalk.gray(`   ${sport}: ${count} players`));
    });
  }
  
  console.log(chalk.bold.green('\n✅ DATABASE CHECK COMPLETE!\n'));
}

comprehensiveDatabaseCheck().catch(console.error);