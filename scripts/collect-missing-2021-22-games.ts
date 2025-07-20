#!/usr/bin/env tsx
/**
 * 🏀🏒 COLLECT MISSING 2021-22 GAMES
 * 
 * Gets the remaining playoff games we're missing
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

const STATUS_MAP: Record<string, string> = {
  'STATUS_FINAL': 'Final',
  'Final': 'Final',
  'completed': 'Final',
  'final': 'Final',
  'STATUS_SCHEDULED': 'scheduled',
  'Scheduled': 'scheduled',
  'scheduled': 'scheduled'
};

function normalizeStatus(espnStatus: string | undefined, homeScore?: number, awayScore?: number): string {
  if ((homeScore !== undefined && homeScore > 0) || (awayScore !== undefined && awayScore > 0)) {
    return 'Final';
  }
  return espnStatus ? (STATUS_MAP[espnStatus] || espnStatus) : 'scheduled';
}

async function collectMissingGames() {
  console.log(chalk.cyan('🏀🏒 COLLECTING MISSING 2021-22 GAMES\n'));
  
  // Check what we have
  const { count: nbaCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .gte('start_time', '2021-10-19')
    .lte('start_time', '2022-06-17');
  
  const { count: nhlCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26');
  
  console.log(chalk.yellow(`Current counts: NBA ${nbaCount}, NHL ${nhlCount}`));
  console.log(chalk.yellow(`Need: NBA ~${1310 - (nbaCount || 0)} more, NHL ~${1400 - (nhlCount || 0)} more\n`));
  
  // Get teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .in('sport', ['NBA', 'NHL']);
  
  const teamMap = new Map<string, number>();
  teams?.forEach(team => teamMap.set(team.external_id, team.id));
  
  // Collect NBA playoffs (April-June 2022)
  console.log(chalk.cyan('📅 Collecting NBA playoffs (April-June 2022)...'));
  const nbaGames = await collectGamesForPeriod('NBA', '2022-04-01', '2022-06-30', teamMap);
  
  // Collect NHL playoffs (April-June 2022)  
  console.log(chalk.cyan('\n📅 Collecting NHL playoffs (April-June 2022)...'));
  const nhlGames = await collectGamesForPeriod('NHL', '2022-04-01', '2022-06-30', teamMap);
  
  // Also check if we're missing regular season games
  console.log(chalk.cyan('\n📅 Checking for missing regular season games...'));
  const nbaMissingReg = await collectGamesForPeriod('NBA', '2021-10-19', '2022-04-15', teamMap);
  const nhlMissingReg = await collectGamesForPeriod('NHL', '2021-10-12', '2022-04-15', teamMap);
  
  // Insert all games
  const allGames = [...nbaGames, ...nhlGames, ...nbaMissingReg, ...nhlMissingReg];
  
  if (allGames.length > 0) {
    console.log(chalk.blue(`\n📥 Inserting ${allGames.length} games...`));
    
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < allGames.length; i += batchSize) {
      const batch = allGames.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'external_id' })
        .select();
      
      if (error) {
        console.error(chalk.red('Insert error:'), error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`✅ Inserted ${inserted} games`));
  }
  
  // Final count
  const { count: finalNBA } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .gte('start_time', '2021-10-19')
    .lte('start_time', '2022-06-17');
  
  const { count: finalNHL } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26');
  
  console.log(chalk.cyan('\n📊 FINAL COUNTS:'));
  console.log(chalk.green(`NBA 2021-22: ${finalNBA} games`));
  console.log(chalk.green(`NHL 2021-22: ${finalNHL} games`));
  
  // Also collect missing 2021 calendar year games
  await collectMissing2021CalendarYear();
}

async function collectGamesForPeriod(
  sport: 'NBA' | 'NHL', 
  startDate: string, 
  endDate: string,
  teamMap: Map<string, number>
): Promise<any[]> {
  const games = [];
  const dates = [];
  
  const currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);
  
  while (currentDate <= endDateObj) {
    dates.push(currentDate.toISOString().slice(0, 10).replace(/-/g, ''));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(chalk.gray(`  Checking ${dates.length} days...`));
  
  // Process in batches
  const batchSize = 50;
  
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    
    const batchGames = await Promise.all(
      batch.map(dateStr => 
        limit(async () => {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.toLowerCase() === 'nba' ? 'basketball/nba' : 'hockey/nhl'}/scoreboard?dates=${dateStr}`;
            const response = await axios.get(url, { timeout: 5000 });
            
            const dayGames = [];
            
            if (response.data.events) {
              for (const event of response.data.events) {
                if (event.competitions?.[0]) {
                  const competition = event.competitions[0];
                  const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
                  const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
                  
                  if (homeTeam && awayTeam) {
                    const homeTeamId = teamMap.get(`espn_${sport.toLowerCase()}_${homeTeam.team.id}`);
                    const awayTeamId = teamMap.get(`espn_${sport.toLowerCase()}_${awayTeam.team.id}`);
                    
                    if (homeTeamId && awayTeamId) {
                      dayGames.push({
                        external_id: `espn_${sport.toLowerCase()}_${event.id}`,
                        sport: sport,
                        start_time: event.date,
                        status: normalizeStatus(
                          event.status?.type?.name,
                          parseInt(homeTeam.score) || 0,
                          parseInt(awayTeam.score) || 0
                        ),
                        home_team_id: homeTeamId,
                        away_team_id: awayTeamId,
                        home_score: parseInt(homeTeam.score) || 0,
                        away_score: parseInt(awayTeam.score) || 0,
                        metadata: {
                          venue: competition.venue?.fullName,
                          season_type: event.season?.slug?.includes('playoff') ? 'playoffs' : 'regular'
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
  
  // Deduplicate
  const uniqueGames = Array.from(
    new Map(games.map(g => [g.external_id, g])).values()
  );
  
  console.log(chalk.gray(`  Found ${uniqueGames.length} games`));
  
  return uniqueGames;
}

async function collectMissing2021CalendarYear() {
  console.log(chalk.cyan('\n📅 COLLECTING MISSING 2021 CALENDAR YEAR GAMES...\n'));
  
  // NFL 2021 season (Sep 2021 - Jan 2022)
  console.log(chalk.yellow('🏈 NFL 2021 season...'));
  const nflGames = await collectSportGames('NFL', '2021-09-09', '2021-12-31');
  
  // MLB 2021 season (Apr-Oct 2021)
  console.log(chalk.yellow('\n⚾ MLB 2021 season...'));
  const mlbGames = await collectSportGames('MLB', '2021-04-01', '2021-11-02');
  
  // NCAA Football 2021 (Aug-Dec 2021)
  console.log(chalk.yellow('\n🏈 NCAA Football 2021...'));
  const ncaaFbGames = await collectSportGames('NCAA_FB', '2021-08-28', '2021-12-31');
  
  // NCAA Basketball 2021-22 (Nov-Dec 2021)
  console.log(chalk.yellow('\n🏀 NCAA Basketball 2021-22...'));
  const ncaaBbGames = await collectSportGames('NCAA_BB', '2021-11-09', '2021-12-31');
  
  console.log(chalk.green(`\n✅ Collected ${nflGames + mlbGames + ncaaFbGames + ncaaBbGames} additional 2021 games`));
}

async function collectSportGames(sport: string, startDate: string, endDate: string): Promise<number> {
  // This would use the universal-sports-collector
  // For now, just return 0 as placeholder
  console.log(chalk.gray(`  Would collect ${sport} from ${startDate} to ${endDate}`));
  return 0;
}

collectMissingGames()
  .then(() => {
    console.log(chalk.green('\n🎯 Missing games collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });