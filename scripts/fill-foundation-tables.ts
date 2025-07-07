#!/usr/bin/env tsx
/**
 * Fill foundation tables (sports, leagues, teams_master)
 * This ensures our data has proper relationships
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fillFoundationTables() {
  console.log(chalk.blue.bold('🏗️ FILLING FOUNDATION TABLES\n'));
  
  // 1. Fill sports table
  console.log(chalk.yellow('Filling sports table...'));
  const sports = [
    { id: 'nfl', name: 'Football', category: 'american_football' },
    { id: 'nba', name: 'Basketball', category: 'basketball' },
    { id: 'mlb', name: 'Baseball', category: 'baseball' },
    { id: 'nhl', name: 'Hockey', category: 'ice_hockey' },
    { id: 'ncaaf', name: 'College Football', category: 'american_football' },
    { id: 'ncaab', name: 'College Basketball', category: 'basketball' }
  ];
  
  for (const sport of sports) {
    const { error } = await supabase
      .from('sports')
      .upsert(sport, { onConflict: 'id' });
    
    if (!error) {
      console.log(`  ✓ ${sport.name}`);
    }
  }
  
  // 2. Fill leagues table
  console.log(chalk.yellow('\nFilling leagues table...'));
  const leagues = [
    { id: 'nfl', name: 'National Football League', sport_id: 'nfl', country: 'USA', level: 'professional' },
    { id: 'nba', name: 'National Basketball Association', sport_id: 'nba', country: 'USA', level: 'professional' },
    { id: 'mlb', name: 'Major League Baseball', sport_id: 'mlb', country: 'USA', level: 'professional' },
    { id: 'nhl', name: 'National Hockey League', sport_id: 'nhl', country: 'USA/Canada', level: 'professional' },
    { id: 'ncaaf', name: 'NCAA Division I Football', sport_id: 'ncaaf', country: 'USA', level: 'college' },
    { id: 'ncaab', name: 'NCAA Division I Basketball', sport_id: 'ncaab', country: 'USA', level: 'college' }
  ];
  
  for (const league of leagues) {
    const { error } = await supabase
      .from('leagues')
      .upsert(league, { onConflict: 'id' });
    
    if (!error) {
      console.log(`  ✓ ${league.name}`);
    }
  }
  
  // 3. Get unique teams from games and create teams_master entries
  console.log(chalk.yellow('\nAnalyzing teams from games table...'));
  
  const { data: games } = await supabase
    .from('games')
    .select('home_team_id, away_team_id, sport_id')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);
  
  if (games) {
    const teamMap = new Map<string, Set<string>>();
    
    // Collect unique teams per sport
    games.forEach(game => {
      const sport = game.sport_id;
      if (!teamMap.has(sport)) {
        teamMap.set(sport, new Set());
      }
      teamMap.get(sport)!.add(game.home_team_id.toString());
      teamMap.get(sport)!.add(game.away_team_id.toString());
    });
    
    console.log('\nTeams found by sport:');
    for (const [sport, teams] of teamMap) {
      console.log(`  ${sport}: ${teams.size} teams`);
    }
    
    // Get team names from existing teams table
    console.log(chalk.yellow('\nCreating teams_master entries...'));
    
    for (const [sport, teamIds] of teamMap) {
      const { data: existingTeams } = await supabase
        .from('teams')
        .select('id, name, abbreviation, location, espn_id')
        .in('id', Array.from(teamIds).map(id => parseInt(id)));
      
      if (existingTeams) {
        for (const team of existingTeams) {
          const teamMasterData = {
            id: team.id,
            name: team.name || `Team ${team.id}`,
            abbreviation: team.abbreviation || `T${team.id}`,
            location: team.location || 'Unknown',
            league_id: sport === 'ncaaf' || sport === 'ncaab' ? sport : sport,
            sport_id: sport,
            external_ids: {
              espn: team.espn_id || team.id.toString()
            },
            is_active: true
          };
          
          const { error } = await supabase
            .from('teams_master')
            .upsert(teamMasterData, { onConflict: 'id' });
          
          if (!error) {
            process.stdout.write('.');
          }
        }
      }
    }
    console.log('\n  ✓ Teams master data created');
  }
  
  // 4. Show summary
  const { count: sportsCount } = await supabase
    .from('sports')
    .select('*', { count: 'exact', head: true });
  
  const { count: leaguesCount } = await supabase
    .from('leagues')
    .select('*', { count: 'exact', head: true });
    
  const { count: teamsCount } = await supabase
    .from('teams_master')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.green.bold('\n✅ FOUNDATION TABLES FILLED!\n'));
  console.log(`Sports: ${sportsCount || 0}`);
  console.log(`Leagues: ${leaguesCount || 0}`);
  console.log(`Teams Master: ${teamsCount || 0}`);
}

fillFoundationTables().catch(console.error);