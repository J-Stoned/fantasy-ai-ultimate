#!/usr/bin/env tsx
/**
 * ⚾ FETCH ALL MLB 2024 GAMES - Get the full season!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN to our team name mapping
const teamMapping: { [key: string]: string } = {
  'Baltimore Orioles': 'Baltimore Orioles',
  'Boston Red Sox': 'Boston Red Sox',
  'New York Yankees': 'New York Yankees',
  'Tampa Bay Rays': 'Tampa Bay Rays',
  'Toronto Blue Jays': 'Toronto Blue Jays',
  'Chicago White Sox': 'Chicago White Sox',
  'Cleveland Guardians': 'Cleveland Guardians',
  'Detroit Tigers': 'Detroit Tigers',
  'Kansas City Royals': 'Kansas City Royals',
  'Minnesota Twins': 'Minnesota Twins',
  'Houston Astros': 'Houston Astros',
  'Los Angeles Angels': 'Los Angeles Angels',
  'Oakland Athletics': 'Oakland Athletics',
  'Seattle Mariners': 'Seattle Mariners',
  'Texas Rangers': 'Texas Rangers',
  'Atlanta Braves': 'Atlanta Braves',
  'Miami Marlins': 'Miami Marlins',
  'New York Mets': 'New York Mets',
  'Philadelphia Phillies': 'Philadelphia Phillies',
  'Washington Nationals': 'Washington Nationals',
  'Chicago Cubs': 'Chicago Cubs',
  'Cincinnati Reds': 'Cincinnati Reds',
  'Milwaukee Brewers': 'Milwaukee Brewers',
  'Pittsburgh Pirates': 'Pittsburgh Pirates',
  'St. Louis Cardinals': 'St. Louis Cardinals',
  'Arizona Diamondbacks': 'Arizona Diamondbacks',
  'Colorado Rockies': 'Colorado Rockies',
  'Los Angeles Dodgers': 'Los Angeles Dodgers',
  'San Diego Padres': 'San Diego Padres',
  'San Francisco Giants': 'San Francisco Giants'
};

async function fetchMLB2024() {
  console.log(chalk.bold.red('⚾ FETCHING ALL MLB 2024 GAMES\n'));
  
  // Load our teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('sport_id', 'mlb');
  
  const teamLookup = new Map<string, number>();
  teams?.forEach(team => {
    teamLookup.set(team.name, team.id);
  });
  
  console.log(`Loaded ${teamLookup.size} MLB teams\n`);
  
  const allGames = [];
  let totalFound = 0;
  
  // MLB 2024: March 20 (spring training games) through October 31
  const startDate = new Date('2024-03-20');
  const endDate = new Date('2024-10-31');
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`;
      const response = await axios.get(url);
      
      if (response.data.events) {
        for (const event of response.data.events) {
          // Skip spring training and exhibition games
          if (event.season.type !== 2) continue; // Type 2 = regular season
          
          totalFound++;
          
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
          
          const homeTeamName = teamMapping[homeTeam.team.displayName] || homeTeam.team.displayName;
          const awayTeamName = teamMapping[awayTeam.team.displayName] || awayTeam.team.displayName;
          
          const homeTeamId = teamLookup.get(homeTeamName);
          const awayTeamId = teamLookup.get(awayTeamName);
          
          if (!homeTeamId || !awayTeamId) {
            console.log(`Missing team: ${homeTeamName} vs ${awayTeamName}`);
            continue;
          }
          
          allGames.push({
            external_id: `espn_mlb_${event.id}`,
            sport_id: 'mlb',
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_team_score: competition.status.type.completed ? parseInt(homeTeam.score) : null,
            away_team_score: competition.status.type.completed ? parseInt(awayTeam.score) : null,
            start_time: event.date,
            status: competition.status.type.completed ? 'completed' : 'scheduled'
          });
        }
      }
      
      process.stdout.write(`\r${currentDate.toISOString().split('T')[0]}: ${totalFound} games found, ${allGames.length} valid`);
      
    } catch (error: any) {
      console.error(`\nError fetching ${dateStr}:`, error.message);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`\n\nTotal games found: ${totalFound}`);
  console.log(`Valid games to add: ${allGames.length}\n`);
  
  // Check what we already have
  const { count: existing } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb')
    .gte('start_time', '2024-01-01');
  
  console.log(`Already in database: ${existing}`);
  console.log(`New games to add: ${allGames.length - (existing || 0)}\n`);
  
  // Insert new games
  if (allGames.length > 0) {
    console.log('Inserting games in batches...');
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < allGames.length; i += batchSize) {
      const batch = allGames.slice(i, i + batchSize);
      
      // Upsert to avoid duplicates
      const { error } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'external_id' });
      
      if (error) {
        console.error('Error inserting batch:', error);
      } else {
        inserted += batch.length;
        console.log(`Progress: ${inserted}/${allGames.length} games`);
      }
    }
  }
  
  console.log(chalk.green('\n✅ DONE! Now run the MLB 2024 stats collector.'));
}

fetchMLB2024().catch(console.error);