#!/usr/bin/env tsx
/**
 * STATS COLLECTOR - Fixed version without headshot_url
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE'
);

class StatsCollectorFixed {
  private stats = {
    games: 0,
    players: 0,
    gameLogs: 0
  };

  async run() {
    console.log('🎯 STATS COLLECTOR - POPULATING DATABASE');
    console.log('=======================================\n');
    
    const startTime = Date.now();
    
    try {
      // Process week 17 and 18 games
      await this.processWeek(17);
      await this.processWeek(18);
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n✅ COMPLETE');
      console.log(`Time: ${elapsed}s`);
      console.log(`Games: ${this.stats.games}`);
      console.log(`Players: ${this.stats.players}`);
      console.log(`Game logs: ${this.stats.gameLogs}`);
      
      await this.checkCoverage();
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async processWeek(week: number) {
    console.log(`\nWeek ${week}:`);
    
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=${week}`
    );
    
    const games = response.data.events?.filter((e: any) => e.status.type.completed) || [];
    console.log(`${games.length} completed games`);
    
    for (const game of games.slice(0, 5)) { // Process first 5 games per week
      await this.processGame(game);
    }
  }

  async processGame(game: any) {
    try {
      console.log(`  ${game.name}`);
      
      // Store game
      await supabase.from('games').upsert({
        external_id: `espn_${game.id}`,
        sport_id: 'nfl',
        start_time: new Date(game.date),
        status: 'completed'
      }, { onConflict: 'external_id' });
      
      this.stats.games++;
      
      // Get stats
      const summary = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
      );
      
      if (summary.data.boxscore?.players) {
        for (const teamData of summary.data.boxscore.players) {
          await this.processTeam(teamData, game.id);
        }
      }
    } catch (error) {
      console.error(`    Error: ${error.message}`);
    }
  }

  async processTeam(teamData: any, gameId: string) {
    for (const statCategory of teamData.statistics || []) {
      if (statCategory.athletes?.length > 0) {
        for (const player of statCategory.athletes) {
          await this.storeStats(player, gameId, statCategory.name, teamData.team.displayName);
        }
      }
    }
  }

  async storeStats(playerData: any, gameId: string, category: string, teamName: string) {
    try {
      const athlete = playerData.athlete;
      if (!athlete) return;
      
      // Simple player data without headshot
      const { data: player } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_${athlete.id}`,
          name: athlete.displayName,
          position: athlete.position ? [athlete.position.abbreviation] : [],
          jersey_number: athlete.jersey,
          team_name: teamName
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (player) {
        this.stats.players++;
        
        const stats = this.parseStats(playerData.stats, category);
        const fantasyPoints = this.calculateFantasyPoints(stats);
        
        if (fantasyPoints > 0) {
          await supabase.from('player_game_logs').insert({
            player_id: player.id,
            game_id: `espn_${gameId}`,
            game_date: new Date(),
            stats: stats,
            fantasy_points: fantasyPoints
          });
          
          this.stats.gameLogs++;
          console.log(`    ✅ ${athlete.displayName}: ${fantasyPoints.toFixed(1)} pts`);
        }
      }
    } catch (error) {
      // Skip errors
    }
  }

  parseStats(statsArray: string[], category: string): any {
    const stats: any = { category };
    
    if (!statsArray) return stats;
    
    if (category === 'passing') {
      const [compAtt, yds, , td, int] = statsArray;
      if (compAtt?.includes('/')) {
        const [comp, att] = compAtt.split('/').map(Number);
        stats.completions = comp || 0;
        stats.attempts = att || 0;
      }
      stats.passing_yards = parseInt(yds) || 0;
      stats.passing_tds = parseInt(td) || 0;
      stats.interceptions = parseInt(int) || 0;
    } else if (category === 'rushing') {
      stats.carries = parseInt(statsArray[0]) || 0;
      stats.rushing_yards = parseInt(statsArray[1]) || 0;
      stats.rushing_tds = parseInt(statsArray[3]) || 0;
    } else if (category === 'receiving') {
      stats.receptions = parseInt(statsArray[0]) || 0;
      stats.receiving_yards = parseInt(statsArray[1]) || 0;
      stats.receiving_tds = parseInt(statsArray[3]) || 0;
    }
    
    return stats;
  }

  calculateFantasyPoints(stats: any): number {
    return (
      (stats.passing_yards || 0) * 0.04 +
      (stats.passing_tds || 0) * 4 +
      (stats.interceptions || 0) * -2 +
      (stats.rushing_yards || 0) * 0.1 +
      (stats.rushing_tds || 0) * 6 +
      (stats.receptions || 0) * 1 +
      (stats.receiving_yards || 0) * 0.1 +
      (stats.receiving_tds || 0) * 6
    );
  }

  async checkCoverage() {
    console.log('\n📊 COVERAGE CHECK:');
    
    const { count: games } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');
    
    const { count: logs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Completed games: ${games}`);
    console.log(`Player game logs: ${logs}`);
    
    if (logs && logs > 1000) {
      console.log('✅ Good coverage for pattern detection!');
    }
  }
}

// Run
new StatsCollectorFixed().run();