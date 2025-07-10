#!/usr/bin/env tsx
/**
 * ⚾ MLB 2025 SEASON COLLECTOR
 * Peak season data collection!
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectMLB2025() {
  console.log(chalk.bold.cyan('⚾ MLB 2025 SEASON COLLECTOR'));
  console.log(chalk.yellow('Collecting current MLB season games!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // Get MLB teams
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport_id', 'mlb');
    
    if (!teams || teams.length === 0) {
      console.log(chalk.red('No MLB teams found!'));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${teams.length} MLB teams`));
    
    // Create team lookup
    const teamLookup = new Map();
    teams.forEach(team => {
      teamLookup.set(team.name.toLowerCase(), team.id);
      if (team.abbreviation) {
        teamLookup.set(team.abbreviation.toLowerCase(), team.id);
      }
      const parts = team.name.split(' ');
      if (parts.length > 1) {
        teamLookup.set(parts[parts.length - 1].toLowerCase(), team.id);
      }
    });
    
    const gamesCollected = [];
    let duplicates = 0;
    let gamesWithScores = 0;
    
    // Collect last 30 days of MLB games
    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`;
        const response = await fetch(url);
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
              console.log(chalk.red(`  Could not find teams: ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`));
              continue;
            }
            
            const isCompleted = competition.status?.type?.completed || false;
            const innings = competition.status?.period || 9;
            
            const gameData = {
              sport_id: 'mlb',
              home_team_id: homeId,
              away_team_id: awayId,
              start_time: event.date || new Date().toISOString(),
              venue: competition.venue?.fullName || 'Unknown',
              home_score: isCompleted ? parseInt(homeTeam.score) : null,
              away_score: isCompleted ? parseInt(awayTeam.score) : null,
              status: competition.status?.type?.name || 'scheduled',
              external_id: event.id || `mlb-${dateStr}-${homeId}-${awayId}`,
              metadata: {
                season: 2025,
                week: Math.floor((new Date().getTime() - new Date('2025-03-20').getTime()) / (7 * 24 * 60 * 60 * 1000)),
                seasonType: 'regular',
                innings: innings,
                extraInnings: innings > 9,
                weather: event.weather || {},
                attendance: competition.attendance || null,
                broadcasts: competition.broadcasts || [],
                winProbability: competition.situation?.lastPlay?.winProbability || null,
                homeTeamStats: competition.competitors?.[0]?.statistics || [],
                awayTeamStats: competition.competitors?.[1]?.statistics || []
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
                const extraStr = innings > 9 ? ` (${innings} inn)` : '';
                console.log(chalk.green(`  ✅ ${homeTeam.team.displayName} ${gameData.home_score} - ${gameData.away_score} ${awayTeam.team.displayName}${extraStr}`));
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
        console.log(chalk.red(`Error fetching date ${dateStr}:`, error.message));
      }
    }
    
    // Insert games
    if (gamesCollected.length > 0) {
      console.log(chalk.cyan(`\n3️⃣ Inserting ${gamesCollected.length} games...`));
      
      const batchSize = 50;
      let inserted = 0;
      
      for (let i = 0; i < gamesCollected.length; i += batchSize) {
        const batch = gamesCollected.slice(i, i + batchSize);
        const { error, data } = await supabase
          .from('games')
          .insert(batch)
          .select();
        
        if (error) {
          console.error(chalk.red(`Error inserting batch:`, error.message));
        } else {
          inserted += data?.length || 0;
          console.log(chalk.gray(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(gamesCollected.length/batchSize)}`));
        }
      }
      
      console.log(chalk.green(`✅ Successfully inserted ${inserted} MLB games!`));
    }
    
    // Summary
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
    console.log(chalk.green(`  Completion rate: ${((mlbWithScores!/totalMLB!)*100).toFixed(1)}%`));
    
    console.log(chalk.yellow('\n⚾ MLB 2025 insights:'));
    console.log(chalk.white('  • 162 games per team = massive data'));
    console.log(chalk.white('  • Games every day = fresh predictions'));
    console.log(chalk.white('  • Mid-season = teams showing true form'));
    console.log(chalk.white('  • Weather impacts scoring significantly'));
    
    console.log(chalk.bold.cyan('\n\n⚾ MLB 2025 COLLECTION COMPLETE!'));
    console.log(chalk.yellow('Ready to train with peak season data'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

collectMLB2025().catch(console.error);