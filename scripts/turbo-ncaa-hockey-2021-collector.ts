#!/usr/bin/env tsx
/**
 * 🏒 TURBO NCAA HOCKEY 2021-22 COLLECTOR
 * 
 * Collects NCAA Hockey games for the 2021-22 season
 * Note: ESPN API doesn't provide player rosters/stats for NCAA Hockey
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import os from 'os';
import { DateTime } from 'luxon';
import ncaaAdapter from './adapters/ncaa-adapter.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X PERFORMANCE SETTINGS
const CPU_CORES = os.cpus().length;
const httpLimit = pLimit(CPU_CORES * 2); // 24 concurrent HTTP requests
const dbLimit = pLimit(CPU_CORES); // 12 concurrent DB operations

console.log(chalk.cyan('🏒 TURBO NCAA HOCKEY 2021-22 COLLECTOR'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores (${CPU_CORES * 2} HTTP threads)`));
console.log(chalk.yellow('   Note: ESPN API limitation - No player stats available for NCAA Hockey'));

class TurboNCAAHockeyCollector {
  private teamIdMap = new Map<string, number>();
  private stats = {
    games: 0,
    errors: 0
  };
  private progressBar: cliProgress.SingleBar;

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: ' {bar} | {percentage}% | {value}/{total} | {task}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async collectAll() {
    const startTime = Date.now();
    
    // First check if we have NCAA Hockey teams
    await this.loadTeamMappings();
    
    if (this.teamIdMap.size === 0) {
      console.log(chalk.yellow('\n⚠️  No NCAA Hockey teams found. Collecting teams first...'));
      await this.collectTeams();
      await this.loadTeamMappings();
    }
    
    console.log(chalk.green(`\n✅ Found ${this.teamIdMap.size} NCAA Hockey teams`));
    
    // Collect games for 2021-22 season
    await this.collectGames();
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.green('\n✅ COLLECTION COMPLETE!'));
    console.log(chalk.blue(`🎮 Games collected: ${this.stats.games.toLocaleString()}`));
    console.log(chalk.blue(`⏱️  Time: ${Math.round(elapsed / 60)} minutes`));
    
    if (this.stats.errors > 0) {
      console.log(chalk.red(`⚠️  Errors: ${this.stats.errors}`));
    }
  }

  private async loadTeamMappings() {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_HKY');
      
    teams?.forEach(team => {
      this.teamIdMap.set(team.external_id, team.id);
    });
  }

  private async collectTeams() {
    console.log(chalk.yellow('Collecting NCAA Hockey teams...'));
    
    try {
      const url = 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams?limit=500';
      const response = await axios.get(url);
      
      const teams = response.data.sports[0].leagues[0].teams;
      console.log(chalk.green(`Found ${teams.length} teams from ESPN API`));
      
      const transformedTeams = teams.map((item: any) => {
        const team = item.team;
        return {
          external_id: `espn_ncaa_hky_${team.id}`,
          name: team.displayName,
          city: team.location || team.displayName.split(' ')[0],
          abbreviation: team.abbreviation,
          sport: 'NCAA_HKY',
          league_id: 'NCAA',
          logo_url: team.logos?.[0]?.href,
          metadata: {
            espn_id: team.id,
            color: team.color,
            alternateColor: team.alternateColor,
            isActive: team.isActive,
            conference: team.groups?.id,
            venue: team.venue?.id
          }
        };
      });
      
      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < transformedTeams.length; i += batchSize) {
        const batch = transformedTeams.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('teams')
          .upsert(batch, {
            onConflict: 'external_id',
            ignoreDuplicates: false
          });
          
        if (error) {
          console.error(chalk.red('Error inserting teams:'), error.message);
        }
      }
      
      console.log(chalk.green(`✅ Inserted ${transformedTeams.length} NCAA Hockey teams`));
    } catch (error) {
      console.error(chalk.red('Error collecting teams:'), error);
    }
  }

  private async collectGames() {
    console.log(chalk.yellow('\n📊 Collecting NCAA Hockey 2021-22 games...'));
    
    // Date ranges for 2021-22 season (October 2021 - April 2022)
    const dateRanges = [
      { start: '20211001', end: '20211031' }, // October
      { start: '20211101', end: '20211130' }, // November
      { start: '20211201', end: '20211231' }, // December
      { start: '20220101', end: '20220131' }, // January
      { start: '20220201', end: '20220228' }, // February
      { start: '20220301', end: '20220331' }, // March
      { start: '20220401', end: '20220410' }  // Early April (Frozen Four)
    ];
    
    const allGames: any[] = [];
    
    // Collect games from all date ranges
    for (const range of dateRanges) {
      const games = await this.fetchGamesForDateRange(range);
      allGames.push(...games);
      console.log(chalk.gray(`  ${range.start} - ${range.end}: ${games.length} games`));
    }
    
    console.log(chalk.green(`\nTotal games found: ${allGames.length}`));
    
    // Process games in batches
    this.progressBar.start(allGames.length, 0, { task: 'Processing games' });
    
    const batchSize = 500;
    for (let i = 0; i < allGames.length; i += batchSize) {
      const batch = allGames.slice(i, i + batchSize);
      
      const transformedGames = batch
        .map(game => {
          const transformed = ncaaAdapter.transformGame(game, 'hockey');
          if (!transformed) return null;
          
          return {
            external_id: `espn_ncaahockey_${game.id}`, // Use correct format
            sport: 'NCAA_HKY',
            home_team_id: this.teamIdMap.get(`espn_ncaa_hky_${transformed.home_team_id}`) || 
                         this.teamIdMap.get(`espn_ncaahockey_${transformed.home_team_id}`), // Try both formats
            away_team_id: this.teamIdMap.get(`espn_ncaa_hky_${transformed.away_team_id}`) ||
                         this.teamIdMap.get(`espn_ncaahockey_${transformed.away_team_id}`), // Try both formats
            start_time: transformed.date,
            home_score: transformed.home_score,
            away_score: transformed.away_score,
            status: transformed.status,
            venue: transformed.metadata.venue,
            metadata: {
              ...transformed.metadata,
              season: '2021-22',
              espn_id: game.id
            }
          };
        })
        .filter(g => g && g.home_team_id && g.away_team_id);
      
      if (transformedGames.length > 0) {
        await dbLimit(async () => {
          const { error } = await supabase
            .from('games')
            .upsert(transformedGames, {
              onConflict: 'external_id',
              ignoreDuplicates: false
            });
            
          if (error) {
            console.error(chalk.red(`\nError inserting games:`), error.message);
            this.stats.errors++;
          } else {
            this.stats.games += transformedGames.length;
          }
        });
      }
      
      this.progressBar.increment(batch.length);
    }
    
    this.progressBar.stop();
  }

  private async fetchGamesForDateRange(range: { start: string; end: string }) {
    const games: any[] = [];
    const startDate = DateTime.fromFormat(range.start, 'yyyyMMdd');
    const endDate = DateTime.fromFormat(range.end, 'yyyyMMdd');
    
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toFormat('yyyyMMdd');
      
      await httpLimit(async () => {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${dateStr}&limit=300`;
          const response = await axios.get(url, { timeout: 10000 });
          
          if (response.data.events) {
            games.push(...response.data.events);
          }
        } catch (error) {
          // Silently continue on error
        }
      });
      
      currentDate = currentDate.plus({ days: 1 });
    }
    
    return games;
  }
}

// Run the collector
async function main() {
  const collector = new TurboNCAAHockeyCollector();
  await collector.collectAll();
}

main().catch(console.error);