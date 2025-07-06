#!/usr/bin/env tsx
/**
 * 🏆 COLLECT ALL 2025 SPORTS DATA
 * NBA, NHL, MLB, NFL - All current seasons!
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN API endpoints
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

async function collectSportGames(sport: string, league: string, daysToCollect: number = 30) {
  console.log(chalk.cyan(`\n📊 Collecting ${sport.toUpperCase()} games...`));
  
  const gamesCollected = [];
  let duplicates = 0;
  let gamesWithScores = 0;
  
  // Get teams for this sport
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', sport);
  
  if (!teams || teams.length === 0) {
    console.log(chalk.yellow(`No teams found for ${sport}`));
    return { collected: 0, withScores: 0 };
  }
  
  // Create team lookup
  const teamLookup = new Map();
  teams.forEach(team => {
    teamLookup.set(team.name.toLowerCase(), team.id);
    if (team.abbreviation) {
      teamLookup.set(team.abbreviation.toLowerCase(), team.id);
    }
    // Handle team name variations
    const parts = team.name.split(' ');
    if (parts.length > 1) {
      teamLookup.set(parts[parts.length - 1].toLowerCase(), team.id);
    }
  });
  
  // Collect games for specified days
  for (let daysAgo = 0; daysAgo < daysToCollect; daysAgo++) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const url = `${ESPN_BASE}/${league}/${sport}/scoreboard?dates=${dateStr}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.events && data.events.length > 0) {
        console.log(chalk.gray(`Date ${date.toISOString().split('T')[0]}: ${data.events.length} games`));
        
        for (const event of data.events) {
          const competition = event.competitions?.[0];
          if (!competition) continue;
          
          const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
          const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
          
          if (!homeTeam || !awayTeam) continue;
          
          // Find team IDs
          const homeId = teamLookup.get(homeTeam.team.displayName?.toLowerCase()) ||
                        teamLookup.get(homeTeam.team.abbreviation?.toLowerCase()) ||
                        teamLookup.get(homeTeam.team.shortDisplayName?.toLowerCase());
                        
          const awayId = teamLookup.get(awayTeam.team.displayName?.toLowerCase()) ||
                        teamLookup.get(awayTeam.team.abbreviation?.toLowerCase()) ||
                        teamLookup.get(awayTeam.team.shortDisplayName?.toLowerCase());
          
          if (!homeId || !awayId) {
            console.log(chalk.red(`  Could not find teams: ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`));
            continue;
          }
          
          const isCompleted = competition.status?.type?.completed || false;
          const homeScore = isCompleted && homeTeam.score ? parseInt(homeTeam.score) : null;
          const awayScore = isCompleted && awayTeam.score ? parseInt(awayTeam.score) : null;
          
          const gameData = {
            sport_id: sport,
            home_team_id: homeId,
            away_team_id: awayId,
            start_time: event.date || new Date().toISOString(),
            venue: competition.venue?.fullName || 'Unknown',
            home_score: homeScore,
            away_score: awayScore,
            status: competition.status?.type?.name || 'scheduled',
            external_id: event.id || `${sport}-${dateStr}-${homeId}-${awayId}`,
            metadata: {
              season: event.season?.year || 2025,
              week: event.week?.number || Math.floor(daysAgo / 7),
              seasonType: event.season?.type === 3 ? 'playoffs' : 'regular',
              attendance: competition.attendance || null,
              weather: event.weather || null,
              broadcasts: competition.broadcasts || [],
              period: competition.status?.period || null,
              displayClock: competition.status?.displayClock || null
            }
          };
          
          // Check if game exists
          const { data: existing } = await supabase
            .from('games')
            .select('id')
            .eq('external_id', gameData.external_id)
            .single();
          
          if (!existing) {
            gamesCollected.push(gameData);
            
            if (gameData.home_score !== null) {
              gamesWithScores++;
              console.log(chalk.green(`  ✅ ${homeTeam.team.displayName} ${gameData.home_score} - ${gameData.away_score} ${awayTeam.team.displayName}`));
            } else {
              const status = competition.status?.type?.shortDetail || 'scheduled';
              console.log(chalk.yellow(`  📅 ${homeTeam.team.displayName} vs ${awayTeam.team.displayName} (${status})`));
            }
          } else {
            duplicates++;
          }
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.log(chalk.red(`Error fetching ${sport} date ${dateStr}:`, error.message));
    }
  }
  
  // Insert games in batches
  if (gamesCollected.length > 0) {
    console.log(chalk.cyan(`\nInserting ${gamesCollected.length} ${sport} games...`));
    
    const batchSize = 50;
    for (let i = 0; i < gamesCollected.length; i += batchSize) {
      const batch = gamesCollected.slice(i, i + batchSize);
      const { error } = await supabase
        .from('games')
        .insert(batch);
      
      if (error) {
        console.error(chalk.red(`Error inserting batch:`, error.message));
      }
    }
  }
  
  console.log(chalk.green(`${sport.toUpperCase()} complete: ${gamesCollected.length} new, ${gamesWithScores} with scores, ${duplicates} duplicates`));
  
  return { collected: gamesCollected.length, withScores: gamesWithScores };
}

async function collectAll2025Games() {
  console.log(chalk.bold.cyan('🏆 COLLECTING ALL 2025 SPORTS DATA'));
  console.log(chalk.yellow('Getting NBA, NHL, MLB, and upcoming NFL games...'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  const totals = {
    collected: 0,
    withScores: 0
  };
  
  try {
    // NBA - Currently in playoffs (June 2025)
    const nba = await collectSportGames('nba', 'basketball', 60);
    totals.collected += nba.collected;
    totals.withScores += nba.withScores;
    
    // NHL - Stanley Cup Finals (June 2025)  
    const nhl = await collectSportGames('nhl', 'hockey', 60);
    totals.collected += nhl.collected;
    totals.withScores += nhl.withScores;
    
    // MLB - Peak season (162 games per team!)
    const mlb = await collectSportGames('mlb', 'baseball', 30);
    totals.collected += mlb.collected;
    totals.withScores += mlb.withScores;
    
    // NFL - Preseason starting soon
    const nfl = await collectSportGames('nfl', 'football', 365); // Check full year for NFL
    totals.collected += nfl.collected;
    totals.withScores += nfl.withScores;
    
    // Summary
    console.log(chalk.cyan('\n═'.repeat(60)));
    console.log(chalk.bold.green('🎉 COLLECTION COMPLETE!'));
    console.log(chalk.yellow(`Total games collected: ${totals.collected}`));
    console.log(chalk.yellow(`Games with scores: ${totals.withScores}`));
    
    // Check totals by sport
    console.log(chalk.cyan('\n📊 Checking database totals...'));
    
    for (const sport of ['nba', 'nhl', 'mlb', 'nfl']) {
      const { count: total } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport);
      
      const { count: withScores } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport)
        .not('home_score', 'is', null);
      
      console.log(chalk.yellow(`${sport.toUpperCase()}: ${total} total, ${withScores} with scores`));
    }
    
    console.log(chalk.cyan('\n🎯 Next steps:'));
    console.log(chalk.white('1. Run multi-sport training with all this data'));
    console.log(chalk.white('2. NBA/NHL playoffs = high stakes = better predictions'));
    console.log(chalk.white('3. MLB daily games = massive training data'));
    console.log(chalk.white('4. NFL preseason = early insights for 2025'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

collectAll2025Games().catch(console.error);