#!/usr/bin/env tsx
/**
 * 🏒 FETCH NCAA HOCKEY GAMES
 * Fetches NCAA Hockey games from ESPN
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ESPNGame {
  id: string;
  date: string;
  status: {
    type: {
      completed: boolean;
      description: string;
    };
  };
  competitions: Array<{
    competitors: Array<{
      id: string;
      team: {
        id: string;
        displayName: string;
      };
      homeAway: string;
      score?: string;
    }>;
    venue?: {
      fullName: string;
      address?: {
        city: string;
        state: string;
      };
    };
  }>;
}

async function fetchNCAAHockeyGames() {
  console.log(chalk.bold.blue('🏒 NCAA HOCKEY GAMES FETCHER\n'));
  
  const gamesFound = [];
  let totalProcessed = 0;
  
  try {
    // Get our NCAA Hockey teams first
    const { data: ncaaTeams } = await supabase
      .from('teams')
      .select('id, external_id, name')
      .eq('sport', 'NCAA_HKY');
    
    if (!ncaaTeams || ncaaTeams.length === 0) {
      console.log(chalk.red('❌ No NCAA Hockey teams found! Run fetch-ncaa-hockey-teams.ts first.'));
      return;
    }
    
    // Create a map of ESPN ID to our team ID
    const teamMap = new Map();
    ncaaTeams.forEach(team => {
      const espnId = team.external_id?.split('_').pop();
      if (espnId) {
        teamMap.set(espnId, team.id);
      }
    });
    
    console.log(`Found ${ncaaTeams.length} NCAA Hockey teams\n`);
    
    // Fetch games for the current season
    const seasons = ['2024', '2025']; // Current and upcoming season
    
    for (const season of seasons) {
      console.log(chalk.yellow(`\n📅 Fetching ${season} season games...`));
      
      // ESPN endpoint for college hockey scoreboard
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${season}`;
      
      // We'll need to fetch multiple dates throughout the season
      const startDate = new Date(`${season}-10-01`); // Season typically starts in October
      const endDate = new Date(`${season}-12-31`); // For now, just fetch through December
      
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
        
        try {
          const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${dateStr}`);
          
          if (!response.ok) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          
          const data = await response.json();
          
          if (data.events && data.events.length > 0) {
            console.log(`Found ${data.events.length} games on ${currentDate.toISOString().split('T')[0]}`);
            
            for (const event of data.events) {
              const game = event as ESPNGame;
              const competition = game.competitions[0];
              
              const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
              const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
              
              if (homeCompetitor && awayCompetitor) {
                const homeTeamId = teamMap.get(homeCompetitor.team.id);
                const awayTeamId = teamMap.get(awayCompetitor.team.id);
                
                if (homeTeamId && awayTeamId) {
                  const gameRecord = {
                    sport: 'NCAA_HKY',
                    home_team_id: homeTeamId,
                    away_team_id: awayTeamId,
                    start_time: game.date,
                    venue: competition.venue?.fullName || null,
                    home_score: game.status.type.completed ? parseInt(homeCompetitor.score || '0') : null,
                    away_score: game.status.type.completed ? parseInt(awayCompetitor.score || '0') : null,
                    status: game.status.type.description,
                    external_id: `espn_ncaahockey_${game.id}`,
                    metadata: {
                      espn_id: game.id,
                      season: season,
                      home_team: homeCompetitor.team.displayName,
                      away_team: awayCompetitor.team.displayName,
                      venue_city: competition.venue?.address?.city,
                      venue_state: competition.venue?.address?.state
                    }
                  };
                  
                  gamesFound.push(gameRecord);
                }
              }
            }
          }
          
          totalProcessed++;
          if (totalProcessed % 30 === 0) {
            console.log(`Processed ${totalProcessed} days...`);
          }
          
        } catch (error) {
          console.error(`Error fetching games for ${dateStr}:`, error);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ Found ${gamesFound.length} total games`);
    
    if (gamesFound.length > 0) {
      // Check for existing games
      const externalIds = gamesFound.map(g => g.external_id);
      const { data: existingGames } = await supabase
        .from('games')
        .select('external_id')
        .in('external_id', externalIds);
      
      const existingIds = new Set(existingGames?.map(g => g.external_id) || []);
      const newGames = gamesFound.filter(g => !existingIds.has(g.external_id));
      
      if (newGames.length > 0) {
        console.log(`\n🚀 Inserting ${newGames.length} new games...`);
        
        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < newGames.length; i += batchSize) {
          const batch = newGames.slice(i, i + batchSize);
          const { error } = await supabase
            .from('games')
            .insert(batch);
          
          if (error) {
            console.error('Error inserting batch:', error);
          } else {
            console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newGames.length / batchSize)}`);
          }
        }
        
        console.log(chalk.green(`✅ Successfully inserted ${newGames.length} NCAA Hockey games!`));
      } else {
        console.log(chalk.yellow('✓ All games already in database'));
      }
    }
    
    // Verify final count
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_HKY');
    
    console.log(chalk.bold.green(`\n🏒 Total NCAA Hockey games in database: ${count}`));
    
  } catch (error) {
    console.error('Error fetching NCAA Hockey games:', error);
  }
}

fetchNCAAHockeyGames().catch(console.error);