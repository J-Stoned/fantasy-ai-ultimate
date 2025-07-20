#!/usr/bin/env tsx
/**
 * 🏒 COLLECT MISSING NHL 2021-22 GAMES
 * 
 * Gets the remaining ~336 playoff games
 */

import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(50);

async function collectMissingNHLGames() {
  console.log(chalk.cyan('🏒 COLLECTING MISSING NHL 2021-22 GAMES\n'));
  
  // Check current count
  const { count: currentCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26');
  
  console.log(chalk.yellow(`Current NHL games: ${currentCount}/~1,400`));
  console.log(chalk.yellow(`Missing: ~${1400 - (currentCount || 0)} games\n`));
  
  // Get teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NHL');
  
  const teamMap = new Map<string, number>();
  teams?.forEach(team => teamMap.set(team.external_id, team.id));
  
  // Collect May-June 2022 (Stanley Cup Playoffs)
  console.log(chalk.cyan('📅 Collecting NHL Stanley Cup Playoffs (May-June 2022)...'));
  
  const games = [];
  const dates = [];
  
  // Generate dates from May 1 to June 30, 2022
  const startDate = new Date('2022-05-01');
  const endDate = new Date('2022-06-30');
  
  while (startDate <= endDate) {
    dates.push(startDate.toISOString().slice(0, 10).replace(/-/g, ''));
    startDate.setDate(startDate.getDate() + 1);
  }
  
  console.log(chalk.gray(`  Checking ${dates.length} days for playoff games...`));
  
  // Process in batches
  const batchSize = 50;
  
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    
    const batchGames = await Promise.all(
      batch.map(dateStr => 
        limit(async () => {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`;
            const response = await axios.get(url, { timeout: 5000 });
            
            const dayGames = [];
            
            if (response.data.events) {
              for (const event of response.data.events) {
                if (event.competitions?.[0]) {
                  const competition = event.competitions[0];
                  const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
                  const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
                  
                  if (homeTeam && awayTeam) {
                    const homeTeamId = teamMap.get(`espn_nhl_${homeTeam.team.id}`);
                    const awayTeamId = teamMap.get(`espn_nhl_${awayTeam.team.id}`);
                    
                    if (homeTeamId && awayTeamId) {
                      dayGames.push({
                        external_id: `espn_nhl_${event.id}`,
                        sport: 'NHL',
                        start_time: event.date,
                        status: event.status?.type?.name === 'STATUS_FINAL' ? 'Final' : 'scheduled',
                        home_team_id: homeTeamId,
                        away_team_id: awayTeamId,
                        home_score: parseInt(homeTeam.score) || 0,
                        away_score: parseInt(awayTeam.score) || 0,
                        metadata: {
                          venue: competition.venue?.fullName,
                          season_type: 'playoffs',
                          round: event.competitions[0].playoffSeries?.summary
                        }
                      });
                    }
                  }
                }
              }
            }
            
            return dayGames;
          } catch {
            return [];
          }
        })
      )
    );
    
    games.push(...batchGames.flat());
  }
  
  // Also check April 2022 for first round games
  console.log(chalk.cyan('\n📅 Checking April 2022 for first round games...'));
  
  const aprilDates = [];
  const aprilStart = new Date('2022-04-15');
  const aprilEnd = new Date('2022-04-30');
  
  while (aprilStart <= aprilEnd) {
    aprilDates.push(aprilStart.toISOString().slice(0, 10).replace(/-/g, ''));
    aprilStart.setDate(aprilStart.getDate() + 1);
  }
  
  for (const dateStr of aprilDates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`;
      const response = await limit(() => axios.get(url, { timeout: 5000 }));
      
      if (response.data.events) {
        for (const event of response.data.events) {
          if (event.competitions?.[0]) {
            const competition = event.competitions[0];
            const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
            
            if (homeTeam && awayTeam) {
              const homeTeamId = teamMap.get(`espn_nhl_${homeTeam.team.id}`);
              const awayTeamId = teamMap.get(`espn_nhl_${awayTeam.team.id}`);
              
              if (homeTeamId && awayTeamId) {
                games.push({
                  external_id: `espn_nhl_${event.id}`,
                  sport: 'NHL',
                  start_time: event.date,
                  status: event.status?.type?.name === 'STATUS_FINAL' ? 'Final' : 'scheduled',
                  home_team_id: homeTeamId,
                  away_team_id: awayTeamId,
                  home_score: parseInt(homeTeam.score) || 0,
                  away_score: parseInt(awayTeam.score) || 0,
                  metadata: {
                    venue: competition.venue?.fullName,
                    season_type: 'playoffs'
                  }
                });
              }
            }
          }
        }
      }
    } catch {}
  }
  
  // Deduplicate
  const uniqueGames = Array.from(
    new Map(games.map(g => [g.external_id, g])).values()
  );
  
  console.log(chalk.blue(`\nFound ${uniqueGames.length} playoff games`));
  
  // Insert games
  if (uniqueGames.length > 0) {
    const { data, error } = await supabase
      .from('games')
      .upsert(uniqueGames, { onConflict: 'external_id' })
      .select();
    
    if (error) {
      console.error(chalk.red('Insert error:'), error);
    } else {
      console.log(chalk.green(`✅ Inserted ${data?.length || 0} games`));
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26');
  
  console.log(chalk.cyan(`\n📊 FINAL NHL 2021-22 count: ${finalCount} games`));
  
  if ((finalCount || 0) >= 1300) {
    console.log(chalk.green('✅ NHL 2021-22 collection complete!'));
  }
}

collectMissingNHLGames()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });