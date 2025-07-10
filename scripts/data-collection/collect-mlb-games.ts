#!/usr/bin/env tsx
/**
 * ⚾ MLB GAME COLLECTOR
 * Collect MLB games - currently in season!
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN MLB API endpoint
const ESPN_MLB_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
const ESPN_MLB_SCHEDULE = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=';

async function collectMLBGames() {
  console.log(chalk.bold.cyan('⚾ MLB GAME COLLECTOR'));
  console.log(chalk.yellow('Collecting MLB games - peak season data!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Get MLB teams
    console.log(chalk.cyan('1️⃣ Loading MLB teams...'));
    
    const { data: mlbTeams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport_id', 'mlb')
      .eq('league_id', 'MLB');
    
    console.log(chalk.green(`✅ Found ${mlbTeams?.length} MLB teams`));
    
    // Create team lookup
    const teamLookup = new Map();
    mlbTeams?.forEach(team => {
      teamLookup.set(team.name.toLowerCase(), team.id);
      teamLookup.set(team.abbreviation?.toLowerCase(), team.id);
      // Handle common names
      const shortName = team.name.split(' ').pop()?.toLowerCase(); // Yankees, Dodgers, etc
      if (shortName) teamLookup.set(shortName, team.id);
    });
    
    // 2. Collect games from last 60 days (lots of MLB games!)
    console.log(chalk.cyan('\n2️⃣ Collecting MLB games from current season...'));
    
    const gamesCollected = [];
    let duplicates = 0;
    let gamesWithScores = 0;
    
    // MLB plays almost every day, so collect more days
    for (let daysAgo = 0; daysAgo < 60; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      
      try {
        const response = await fetch(`${ESPN_MLB_SCHEDULE}${dateStr}`);
        const data = await response.json();
        
        if (data.events && data.events.length > 0) {
          console.log(chalk.gray(`\nDate ${date.toISOString().split('T')[0]}: ${data.events.length} games`));
          
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
              console.log(chalk.red(`Could not find teams: ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`));
              continue;
            }
            
            // Get additional game info
            const innings = competition.status?.period || 9;
            const isCompleted = competition.status?.type?.completed || false;
            
            const gameData = {
              sport_id: 'mlb',
              home_team_id: homeId,
              away_team_id: awayId,
              start_time: event.date,
              venue: competition.venue?.fullName || 'Unknown',
              home_score: isCompleted ? parseInt(homeTeam.score) : null,
              away_score: isCompleted ? parseInt(awayTeam.score) : null,
              status: competition.status?.type?.name || 'scheduled',
              season_year: 2024,
              week: Math.floor((new Date().getTime() - new Date('2024-03-28').getTime()) / (7 * 24 * 60 * 60 * 1000)),
              external_id: event.id,
              metadata: {
                innings: innings,
                weather: event.weather || {},
                attendance: competition.attendance || null,
                seasonType: 'regular'
              }
            };
            
            // Check if game exists
            const { data: existing } = await supabase
              .from('games')
              .select('id')
              .eq('external_id', event.id)
              .single();
            
            if (!existing) {
              gamesCollected.push(gameData);
              
              if (gameData.home_score !== null) {
                gamesWithScores++;
                console.log(chalk.green(`  ✅ ${homeTeam.team.displayName} ${gameData.home_score} - ${gameData.away_score} ${awayTeam.team.displayName}`));
              } else {
                console.log(chalk.yellow(`  📅 ${homeTeam.team.displayName} vs ${awayTeam.team.displayName} (${competition.status?.type?.shortDetail || 'scheduled'})`));
              }
            } else {
              duplicates++;
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(chalk.red(`Error fetching date ${dateStr}:`, error.message));
      }
    }
    
    // 3. Insert games
    if (gamesCollected.length > 0) {
      console.log(chalk.cyan('\n3️⃣ Inserting games into database...'));
      
      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < gamesCollected.length; i += batchSize) {
        const batch = gamesCollected.slice(i, i + batchSize);
        const { error } = await supabase
          .from('games')
          .insert(batch);
        
        if (error) {
          console.error(chalk.red(`Error inserting batch ${i/batchSize + 1}:`), error);
        } else {
          console.log(chalk.gray(`Inserted batch ${i/batchSize + 1}/${Math.ceil(gamesCollected.length/batchSize)}`));
        }
      }
      
      console.log(chalk.green(`✅ Inserted ${gamesCollected.length} new MLB games!`));
    }
    
    // 4. Summary
    console.log(chalk.cyan('\n4️⃣ Collection Summary'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.green(`New games collected: ${gamesCollected.length}`));
    console.log(chalk.green(`Games with final scores: ${gamesWithScores}`));
    console.log(chalk.yellow(`Duplicates skipped: ${duplicates}`));
    
    // Check total MLB games
    const { count: totalMLB } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'mlb');
    
    const { count: mlbWithScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'mlb')
      .not('home_score', 'is', null);
    
    console.log(chalk.cyan('\n📊 Total MLB games in database:'));
    console.log(chalk.green(`  Total: ${totalMLB}`));
    console.log(chalk.green(`  With scores: ${mlbWithScores}`));
    
    // 5. MLB-specific insights
    console.log(chalk.yellow('\n⚾ MLB prediction advantages:'));
    console.log(chalk.white('  • 162 games per season (huge sample size!)'));
    console.log(chalk.white('  • Games every day (constant fresh data)'));
    console.log(chalk.white('  • Pitching matchups are crucial'));
    console.log(chalk.white('  • Weather plays a big role'));
    console.log(chalk.white('  • Home field less important than other sports'));
    
    console.log(chalk.yellow('\n📈 Key MLB prediction factors:'));
    console.log(chalk.white('  • Starting pitcher ERA and recent form'));
    console.log(chalk.white('  • Bullpen strength and usage'));
    console.log(chalk.white('  • Team batting average vs pitcher type'));
    console.log(chalk.white('  • Recent run production (hot/cold streaks)'));
    console.log(chalk.white('  • Day game after night game fatigue'));
    
    console.log(chalk.bold.cyan('\n\n⚾ MLB COLLECTION COMPLETE!'));
    console.log(chalk.yellow('Ready to train MLB prediction model'));
    console.log(chalk.yellow('Expected accuracy: 55-58% (with proper features)'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

collectMLBGames().catch(console.error);