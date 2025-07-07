#!/usr/bin/env tsx
/**
 * Collect real games for NBA, MLB, NHL, and NCAA
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class RealSportsCollector {
  private collected = {
    nba: 0,
    mlb: 0,
    nhl: 0,
    ncaaf: 0,
    ncaab: 0
  };
  
  async collectAll() {
    console.log(chalk.blue.bold('🏆 COLLECTING REAL SPORTS DATA\n'));
    
    await this.collectNBA();
    await this.collectMLB();
    await this.collectNHL();
    await this.collectNCAAF();
    await this.collectNCAAB();
    
    this.showSummary();
  }
  
  private async collectNBA() {
    console.log(chalk.cyan('🏀 NBA 2024-25 Season...'));
    
    // Get games from recent months
    const dates = ['20241022-20241130', '20241201-20241231', '20250101-20250131'];
    
    for (const dateRange of dates) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateRange}`
        );
        
        const events = response.data.events || [];
        let saved = 0;
        
        for (const event of events) {
          if (event.status?.type?.completed) {
            if (await this.saveGame('nba', event)) saved++;
          }
        }
        
        console.log(`   ${dateRange}: ${saved} games`);
        this.collected.nba += saved;
        
      } catch (error) {
        console.log(chalk.red(`   ${dateRange} failed`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  private async collectMLB() {
    console.log(chalk.cyan('\n⚾ MLB 2024 Season...'));
    
    // Sample dates from the season
    const dates = ['20240401', '20240501', '20240601', '20240701', '20240801', '20240901'];
    
    for (const date of dates) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`
        );
        
        const events = response.data.events || [];
        let saved = 0;
        
        for (const event of events) {
          if (event.status?.type?.completed) {
            if (await this.saveGame('mlb', event)) saved++;
          }
        }
        
        this.collected.mlb += saved;
        
      } catch (error) {
        // Skip
      }
      
      process.stdout.write(`\r   Collected ${this.collected.mlb} games...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log('');
  }
  
  private async collectNHL() {
    console.log(chalk.cyan('\n🏒 NHL 2024-25 Season...'));
    
    const dates = ['20241008-20241031', '20241101-20241130', '20241201-20241231'];
    
    for (const dateRange of dates) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateRange}`
        );
        
        const events = response.data.events || [];
        let saved = 0;
        
        for (const event of events) {
          if (event.status?.type?.completed) {
            if (await this.saveGame('nhl', event)) saved++;
          }
        }
        
        console.log(`   ${dateRange}: ${saved} games`);
        this.collected.nhl += saved;
        
      } catch (error) {
        console.log(chalk.red(`   ${dateRange} failed`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  private async collectNCAAF() {
    console.log(chalk.cyan('\n🏈 NCAA Football 2024...'));
    
    // Sample weeks
    for (let week = 1; week <= 12; week += 3) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&week=${week}&dates=2024&limit=50`
        );
        
        const events = response.data.events || [];
        let saved = 0;
        
        for (const event of events.slice(0, 20)) { // Limit to avoid overwhelming
          if (event.status?.type?.completed) {
            if (await this.saveGame('ncaaf', event, week)) saved++;
          }
        }
        
        this.collected.ncaaf += saved;
        
      } catch (error) {
        // Skip
      }
      
      process.stdout.write(`\r   Collected ${this.collected.ncaaf} games...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log('');
  }
  
  private async collectNCAAB() {
    console.log(chalk.cyan('\n🏀 NCAA Basketball 2024-25...'));
    
    const dates = ['20241201', '20241215', '20250101'];
    
    for (const date of dates) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=${date}&limit=30`
        );
        
        const events = response.data.events || [];
        let saved = 0;
        
        for (const event of events.slice(0, 15)) { // Limit
          if (event.status?.type?.completed) {
            if (await this.saveGame('ncaab', event)) saved++;
          }
        }
        
        this.collected.ncaab += saved;
        
      } catch (error) {
        // Skip
      }
      
      process.stdout.write(`\r   Collected ${this.collected.ncaab} games...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log('');
  }
  
  private async saveGame(sport: string, event: any, week?: number): Promise<boolean> {
    try {
      const comp = event.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!home || !away) return false;
      
      const gameData = {
        home_team_id: parseInt(home.team.id),
        away_team_id: parseInt(away.team.id),
        sport_id: sport,
        start_time: event.date,
        venue: comp.venue?.fullName || event.name,
        home_score: parseInt(home.score),
        away_score: parseInt(away.score),
        status: 'completed',
        external_id: `${sport}_${event.id}`,
        metadata: {
          week: week,
          season: new Date(event.date).getFullYear(),
          attendance: comp.attendance
        }
      };
      
      const { error } = await supabase
        .from('games')
        .upsert(gameData, { onConflict: 'external_id' });
        
      return !error;
      
    } catch (error) {
      return false;
    }
  }
  
  private showSummary() {
    console.log(chalk.green.bold('\n✅ COLLECTION COMPLETE!\n'));
    
    Object.entries(this.collected).forEach(([sport, count]) => {
      if (count > 0) {
        console.log(`${sport.toUpperCase()}: ${count} games`);
      }
    });
    
    const total = Object.values(this.collected).reduce((a, b) => a + b, 0);
    console.log(chalk.cyan(`\nTOTAL: ${total} real games collected`));
    
    // Show samples
    this.showSamples();
  }
  
  private async showSamples() {
    console.log(chalk.blue('\nSample games by sport:'));
    
    for (const sport of ['nba', 'mlb', 'nhl']) {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', sport)
        .like('external_id', `${sport}_%`)
        .order('start_time', { ascending: false })
        .limit(1);
        
      if (data && data[0]) {
        const game = data[0];
        const date = new Date(game.start_time).toLocaleDateString();
        console.log(`  ${sport.toUpperCase()}: ${date} - Team ${game.away_team_id} @ Team ${game.home_team_id} (${game.away_score}-${game.home_score})`);
      }
    }
  }
}

const collector = new RealSportsCollector();
collector.collectAll().catch(console.error);