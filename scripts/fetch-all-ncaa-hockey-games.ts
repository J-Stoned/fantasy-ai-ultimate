#!/usr/bin/env tsx
/**
 * 🏒 FETCH ALL NCAA HOCKEY GAMES
 * Fetches all NCAA Hockey games without filtering
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
  name: string;
  shortName: string;
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
        abbreviation?: string;
      };
      homeAway: string;
      score?: string;
    }>;
    venue?: {
      id?: string;
      fullName: string;
      address?: {
        city: string;
        state: string;
      };
    };
  }>;
}

// Parallel date fetcher
async function fetchGamesForDate(date: Date): Promise<any[]> {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${dateStr}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error(`Error fetching ${dateStr}:`, error);
    return [];
  }
}

async function fetchAllNCAAHockeyGames() {
  console.log(chalk.bold.blue('🏒 FETCHING ALL NCAA HOCKEY GAMES\n'));
  
  const allGames = [];
  
  try {
    // Get our teams for mapping (but we'll save all games)
    const { data: ncaaTeams } = await supabase
      .from('teams')
      .select('id, external_id, name')
      .eq('sport', 'NCAA_HKY');
    
    // Create team map
    const teamMap = new Map();
    const teamByName = new Map();
    
    ncaaTeams?.forEach(team => {
      const espnId = team.external_id?.split('_').pop();
      if (espnId) {
        teamMap.set(espnId, team.id);
      }
      // Also map by name for fallback
      teamByName.set(team.name.toLowerCase(), team.id);
    });
    
    console.log(`Found ${ncaaTeams?.length || 0} NCAA Hockey teams for mapping\n`);
    
    // Fetch TWO FULL SEASONS
    const seasons = [
      { start: new Date('2023-10-01'), end: new Date('2024-04-30') }, // 2023-24 season
      { start: new Date('2024-10-01'), end: new Date('2025-04-30') }  // 2024-25 season
    ];
    
    for (const season of seasons) {
      console.log(chalk.yellow(`\n📅 Fetching ${season.start.getFullYear()}-${season.end.getFullYear()} season...`));
      
      // Create array of all dates in season
      const dates = [];
      const current = new Date(season.start);
      while (current <= season.end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      console.log(`Processing ${dates.length} days...`);
      
      // Process dates in parallel batches (12 at a time for your CPU)
      const batchSize = 12;
      for (let i = 0; i < dates.length; i += batchSize) {
        const batch = dates.slice(i, i + batchSize);
        
        // Fetch batch in parallel
        const batchResults = await Promise.all(batch.map(date => fetchGamesForDate(date)));
        
        // Process results
        batchResults.forEach((events, idx) => {
          if (events.length > 0) {
            const date = batch[idx];
            console.log(`${date.toISOString().split('T')[0]}: ${events.length} games`);
            
            events.forEach((event: ESPNGame) => {
              const competition = event.competitions[0];
              if (!competition) return;
              
              const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
              const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
              
              if (homeCompetitor && awayCompetitor) {
                // Try to find team IDs
                let homeTeamId = teamMap.get(homeCompetitor.team.id);
                let awayTeamId = teamMap.get(awayCompetitor.team.id);
                
                // Fallback to name matching
                if (!homeTeamId) {
                  homeTeamId = teamByName.get(homeCompetitor.team.displayName.toLowerCase());
                }
                if (!awayTeamId) {
                  awayTeamId = teamByName.get(awayCompetitor.team.displayName.toLowerCase());
                }
                
                const gameRecord = {
                  sport: 'NCAA_HKY',
                  home_team_id: homeTeamId || null,
                  away_team_id: awayTeamId || null,
                  start_time: event.date,
                  venue: competition.venue?.fullName || null,
                  home_score: event.status.type.completed ? parseInt(homeCompetitor.score || '0') : null,
                  away_score: event.status.type.completed ? parseInt(awayCompetitor.score || '0') : null,
                  status: event.status.type.description,
                  external_id: `espn_ncaahockey_${event.id}`,
                  metadata: {
                    espn_id: event.id,
                    season: `${season.start.getFullYear()}-${season.end.getFullYear()}`,
                    home_team: homeCompetitor.team.displayName,
                    home_team_espn_id: homeCompetitor.team.id,
                    away_team: awayCompetitor.team.displayName,
                    away_team_espn_id: awayCompetitor.team.id,
                    venue_city: competition.venue?.address?.city,
                    venue_state: competition.venue?.address?.state,
                    game_name: event.name,
                    short_name: event.shortName
                  }
                };
                
                allGames.push(gameRecord);
              }
            });
          }
        });
        
        // Progress update
        if ((i + batchSize) % 60 === 0) {
          console.log(`  Processed ${Math.min(i + batchSize, dates.length)}/${dates.length} days...`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(chalk.green(`\n✅ Found ${allGames.length} total games`));
    
    // Remove the existing games and insert all
    if (allGames.length > 0) {
      // Delete existing NCAA_HKY games first
      console.log(chalk.yellow('\nRemoving old NCAA Hockey games...'));
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('sport', 'NCAA_HKY');
      
      if (deleteError) {
        console.error('Error deleting old games:', deleteError);
      }
      
      console.log(chalk.yellow(`\n🚀 Inserting ${allGames.length} games...`));
      
      // Insert in batches
      const batchSize = 500;
      let inserted = 0;
      
      for (let i = 0; i < allGames.length; i += batchSize) {
        const batch = allGames.slice(i, i + batchSize);
        const { error, data } = await supabase
          .from('games')
          .insert(batch)
          .select();
        
        if (error) {
          console.error('Error inserting batch:', error);
        } else {
          inserted += data.length;
          console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allGames.length / batchSize)} (${inserted} total)`);
        }
      }
      
      console.log(chalk.green(`✅ Successfully inserted ${inserted} NCAA Hockey games!`));
    }
    
    // Verify final count
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_HKY');
    
    console.log(chalk.bold.green(`\n🏒 Total NCAA Hockey games in database: ${count}`));
    
    // Show breakdown
    const { data: seasonBreakdown } = await supabase
      .from('games')
      .select('metadata')
      .eq('sport', 'NCAA_HKY');
    
    const seasonCounts: Record<string, number> = {};
    seasonBreakdown?.forEach(game => {
      const season = game.metadata?.season || 'Unknown';
      seasonCounts[season] = (seasonCounts[season] || 0) + 1;
    });
    
    console.log('\nGames by season:');
    Object.entries(seasonCounts).forEach(([season, count]) => {
      console.log(`  ${season}: ${count} games`);
    });
    
  } catch (error) {
    console.error('Error fetching NCAA Hockey games:', error);
  }
}

fetchAllNCAAHockeyGames().catch(console.error);