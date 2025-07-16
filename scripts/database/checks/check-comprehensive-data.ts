#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface TableCount {
  name: string;
  count: number;
  sport?: string;
}

interface SportData {
  id: string;
  name: string;
  sport_type: string;
}

async function checkDatabaseData() {
  console.log(chalk.cyan.bold('\n🔍 COMPREHENSIVE DATABASE DATA CHECK'));
  console.log(chalk.cyan('=' .repeat(60) + '\n'));

  try {
    // 1. Check core sports data
    console.log(chalk.yellow.bold('📊 SPORTS DATA:'));
    const { data: sports, error: sportsError } = await supabase
      .from('sports')
      .select('*');

    if (sportsError) {
      console.log(chalk.red('Error fetching sports:', sportsError.message));
      return;
    }

    const sportMap = new Map<string, SportData>();
    if (sports && sports.length > 0) {
      console.log(chalk.green(`\nFound ${sports.length} sports:`));
      sports.forEach(sport => {
        sportMap.set(sport.id, sport);
        console.log(`  - ${chalk.white(sport.name)} (${sport.sport_type})`);
      });
    } else {
      console.log(chalk.red('No sports found in database!'));
    }

    // 2. Check leagues by sport
    console.log(chalk.yellow.bold('\n📋 LEAGUES BY SPORT:'));
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, name, abbreviation, sport_id, level')
      .order('sport_id');

    if (leagues && leagues.length > 0) {
      const leaguesBySport = new Map<string, any[]>();
      leagues.forEach(league => {
        if (!leaguesBySport.has(league.sport_id)) {
          leaguesBySport.set(league.sport_id, []);
        }
        leaguesBySport.get(league.sport_id)?.push(league);
      });

      leaguesBySport.forEach((sportLeagues, sportId) => {
        const sport = sportMap.get(sportId);
        console.log(`\n  ${chalk.cyan(sport?.name || 'Unknown Sport')}:`);
        sportLeagues.forEach(league => {
          console.log(`    - ${league.name} (${league.abbreviation || 'N/A'}) - ${league.level}`);
        });
      });
    }

    // 3. Check teams by sport
    console.log(chalk.yellow.bold('\n🏆 TEAMS COUNT BY SPORT:'));
    const { data: teamCounts } = await supabase
      .from('teams_master')
      .select('league_id, leagues!inner(sport_id, sports!inner(name))')
      .select('*', { count: 'exact' });

    const teamsBySport = new Map<string, number>();
    if (teamCounts) {
      // Count teams by sport
      for (const sportData of sportMap.values()) {
        const { count } = await supabase
          .from('teams_master')
          .select('*', { count: 'exact', head: true })
          .eq('leagues.sport_id', sportData.id)
          .single();
        
        if (count && count > 0) {
          teamsBySport.set(sportData.name, count);
        }
      }

      teamsBySport.forEach((count, sport) => {
        console.log(`  ${chalk.white(sport)}: ${chalk.green(count)} teams`);
      });
    }

    // 4. Check players by sport
    console.log(chalk.yellow.bold('\n👤 PLAYERS COUNT BY SPORT:'));
    for (const sportData of sportMap.values()) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sportData.id);
      
      if (count && count > 0) {
        console.log(`  ${chalk.white(sportData.name)}: ${chalk.green(count.toLocaleString())} players`);
      }
    }

    // 5. Check games by sport
    console.log(chalk.yellow.bold('\n🎮 GAMES COUNT BY SPORT:'));
    for (const sportData of sportMap.values()) {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sportData.id);
      
      if (count && count > 0) {
        console.log(`  ${chalk.white(sportData.name)}: ${chalk.green(count.toLocaleString())} games`);
      }
    }

    // 6. Check player stats by sport
    console.log(chalk.yellow.bold('\n📈 PLAYER STATS BY SPORT:'));
    for (const sportData of sportMap.values()) {
      const { data: stats } = await supabase
        .from('player_stats')
        .select('id, player_id, players!inner(sport_id)')
        .eq('players.sport_id', sportData.id)
        .limit(1);
      
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('players.sport_id', sportData.id);
      
      if (count && count > 0) {
        console.log(`  ${chalk.white(sportData.name)}: ${chalk.green(count.toLocaleString())} stat entries`);
      }
    }

    // 7. Check NBA-specific data
    console.log(chalk.yellow.bold('\n🏀 NBA-SPECIFIC DATA:'));
    const nbaId = Array.from(sportMap.values()).find(s => s.name === 'Basketball' || s.sport_type === 'basketball')?.id;
    
    if (nbaId) {
      // NBA Teams
      const { count: nbaTeams } = await supabase
        .from('teams_master')
        .select('*', { count: 'exact', head: true })
        .eq('leagues.sport_id', nbaId)
        .eq('leagues.abbreviation', 'NBA');
      
      console.log(`  NBA Teams: ${chalk.green(nbaTeams || 0)}`);

      // NBA Players
      const { count: nbaPlayers } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', nbaId)
        .eq('current_league_id', leagues?.find(l => l.abbreviation === 'NBA')?.id);
      
      console.log(`  NBA Players: ${chalk.green(nbaPlayers || 0)}`);

      // Recent NBA Games
      const { data: recentGames } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', nbaId)
        .gte('game_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('game_date', { ascending: false })
        .limit(5);
      
      if (recentGames && recentGames.length > 0) {
        console.log(`  Recent NBA Games: ${chalk.green(recentGames.length)} in last 7 days`);
      }

      // NBA Player Stats
      const { count: nbaStats } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('players.sport_id', nbaId)
        .eq('season', new Date().getFullYear());
      
      console.log(`  NBA Player Stats (${new Date().getFullYear()} season): ${chalk.green(nbaStats || 0)}`);
    } else {
      console.log(chalk.red('  No Basketball/NBA sport found in database!'));
    }

    // 8. Check other important tables
    console.log(chalk.yellow.bold('\n📰 OTHER DATA TABLES:'));
    
    const otherTables = [
      'player_injuries',
      'news_articles',
      'social_mentions',
      'betting_lines',
      'prop_bets',
      'fantasy_projections',
      'weather_conditions',
      'player_game_logs'
    ];

    for (const table of otherTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error && count !== null) {
        console.log(`  ${chalk.white(table)}: ${chalk.green(count.toLocaleString())} records`);
      }
    }

    // 9. Check recent data insertions
    console.log(chalk.yellow.bold('\n🕐 RECENT DATA ACTIVITY (Last 24 hours):'));
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentTables = ['players', 'games', 'player_stats', 'news_articles', 'player_injuries'];
    
    for (const table of recentTables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);
      
      if (count && count > 0) {
        console.log(`  ${chalk.white(table)}: ${chalk.green(count)} new records`);
      }
    }

    // 10. Summary
    console.log(chalk.cyan.bold('\n📊 DATABASE SUMMARY:'));
    
    const totalTables = [
      'sports', 'leagues', 'teams_master', 'players', 'games', 
      'player_stats', 'player_injuries', 'news_articles'
    ];
    
    let grandTotal = 0;
    for (const table of totalTables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (count) {
        grandTotal += count;
      }
    }
    
    console.log(`  Total records across main tables: ${chalk.green.bold(grandTotal.toLocaleString())}`);
    console.log(`  Sports configured: ${chalk.green(sportMap.size)}`);
    console.log(`  Active leagues: ${chalk.green(leagues?.length || 0)}`);

  } catch (error) {
    console.error(chalk.red('Error during database check:'), error);
  }
}

// Execute the check
console.log(chalk.gray('Connecting to Supabase...'));
checkDatabaseData()
  .then(() => {
    console.log(chalk.cyan.bold('\n✅ Database check complete!\n'));
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });