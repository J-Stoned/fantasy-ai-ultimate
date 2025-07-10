#!/usr/bin/env tsx
/**
 * Collect REAL sports data from ESPN APIs
 * Gets actual completed games with real scores
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

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  competitions: Array<{
    competitors: Array<{
      id: string;
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
      };
      score: string;
      homeAway: string;
    }>;
    venue?: {
      fullName: string;
    };
    attendance?: number;
  }>;
  status: {
    type: {
      completed: boolean;
      description: string;
    };
  };
}

class RealSportsCollector {
  private gamesCollected = 0;
  private errors = 0;
  
  async collectAll() {
    console.log(chalk.blue.bold('🏆 COLLECTING REAL SPORTS DATA FROM ESPN\n'));
    console.log(chalk.yellow('This will collect actual completed games from recent seasons\n'));
    
    // First, clear out fake data
    await this.clearFakeData();
    
    // Collect each sport
    await this.collectNFL2024();
    await this.collectNBA2024();
    await this.collectMLB2024();
    await this.collectNHL2024();
    
    // Summary
    console.log(chalk.green.bold('\n✅ COLLECTION COMPLETE!\n'));
    console.log(`Total games collected: ${this.gamesCollected}`);
    console.log(`Errors encountered: ${this.errors}`);
    
    if (this.gamesCollected > 0) {
      console.log(chalk.cyan('\nYou now have REAL sports data to analyze!'));
    }
  }
  
  private async clearFakeData() {
    console.log(chalk.yellow('Clearing fake future games...'));
    
    // Delete games with future dates
    const { count } = await supabase
      .from('games')
      .delete()
      .gt('start_time', new Date().toISOString())
      .not('id', 'is', null);
      
    if (count) {
      console.log(chalk.green(`   ✓ Deleted ${count} future/fake games`));
    }
  }
  
  private async collectNFL2024() {
    console.log(chalk.cyan('\n📏 Collecting NFL 2024 Season...'));
    
    try {
      let weekGames = 0;
      
      // NFL 2024 regular season: Weeks 1-18
      for (let week = 1; week <= 18; week++) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`;
        
        try {
          const response = await axios.get(url);
          const events = response.data.events || [];
          
          for (const event of events) {
            if (event.status.type.completed) {
              await this.saveGame('nfl', event, week);
              weekGames++;
            }
          }
          
          process.stdout.write(`\r   Week ${week}: ${weekGames} games`);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          this.errors++;
        }
      }
      
      console.log(chalk.green(`\n   ✓ Collected ${weekGames} NFL games`));
      
    } catch (error) {
      console.error(chalk.red('   ✗ Failed to collect NFL data'));
      this.errors++;
    }
  }
  
  private async collectNBA2024() {
    console.log(chalk.cyan('\n🏀 Collecting NBA 2024-25 Season...'));
    
    try {
      let totalGames = 0;
      
      // NBA season runs Oct 2024 - April 2025
      // Get games by date range (first 3 months)
      const dates = [
        '20241022-20241031', // October
        '20241101-20241130', // November
        '20241201-20241231', // December
        '20250101-20250131', // January
        '20250201-20250228'  // February
      ];
      
      for (const dateRange of dates) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateRange}`;
        
        try {
          const response = await axios.get(url);
          const events = response.data.events || [];
          
          let rangeGames = 0;
          for (const event of events) {
            if (event.status.type.completed) {
              await this.saveGame('nba', event);
              rangeGames++;
            }
          }
          
          totalGames += rangeGames;
          console.log(`   ${dateRange}: ${rangeGames} games`);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          this.errors++;
        }
      }
      
      console.log(chalk.green(`   ✓ Collected ${totalGames} NBA games`));
      
    } catch (error) {
      console.error(chalk.red('   ✗ Failed to collect NBA data'));
      this.errors++;
    }
  }
  
  private async collectMLB2024() {
    console.log(chalk.cyan('\n⚾ Collecting MLB 2024 Season...'));
    
    try {
      let totalGames = 0;
      
      // MLB season April-October
      // Sample some dates to avoid overwhelming the API
      const sampleDates = [
        '20240401', '20240415', '20240501', '20240515',
        '20240601', '20240615', '20240701', '20240715',
        '20240801', '20240815', '20240901', '20240915'
      ];
      
      for (const date of sampleDates) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`;
        
        try {
          const response = await axios.get(url);
          const events = response.data.events || [];
          
          for (const event of events) {
            if (event.status.type.completed) {
              await this.saveGame('mlb', event);
              totalGames++;
            }
          }
          
          process.stdout.write(`\r   Collected ${totalGames} games...`);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          this.errors++;
        }
      }
      
      console.log(chalk.green(`\n   ✓ Collected ${totalGames} MLB games`));
      
    } catch (error) {
      console.error(chalk.red('   ✗ Failed to collect MLB data'));
      this.errors++;
    }
  }
  
  private async collectNHL2024() {
    console.log(chalk.cyan('\n🏒 Collecting NHL 2024-25 Season...'));
    
    try {
      let totalGames = 0;
      
      // NHL season Oct 2024 - April 2025
      const dates = [
        '20241008-20241031', // October
        '20241101-20241130', // November
        '20241201-20241231', // December
        '20250101-20250131'  // January
      ];
      
      for (const dateRange of dates) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateRange}`;
        
        try {
          const response = await axios.get(url);
          const events = response.data.events || [];
          
          let rangeGames = 0;
          for (const event of events) {
            if (event.status.type.completed) {
              await this.saveGame('nhl', event);
              rangeGames++;
            }
          }
          
          totalGames += rangeGames;
          console.log(`   ${dateRange}: ${rangeGames} games`);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          this.errors++;
        }
      }
      
      console.log(chalk.green(`   ✓ Collected ${totalGames} NHL games`));
      
    } catch (error) {
      console.error(chalk.red('   ✗ Failed to collect NHL data'));
      this.errors++;
    }
  }
  
  private async saveGame(sport: string, event: any, week?: number) {
    try {
      const competition = event.competitions[0];
      const competitors = competition.competitors;
      
      const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) return;
      
      // First ensure teams exist
      await this.ensureTeam(sport, homeTeam.team);
      await this.ensureTeam(sport, awayTeam.team);
      
      // Save game
      const gameData = {
        id: parseInt(event.id),
        sport_id: sport,
        season: new Date(event.date).getFullYear(),
        season_type: 2, // Regular season
        week: week || null,
        start_time: event.date,
        status: 'completed',
        home_team_id: parseInt(homeTeam.team.id),
        away_team_id: parseInt(awayTeam.team.id),
        home_score: parseInt(homeTeam.score),
        away_score: parseInt(awayTeam.score),
        venue: competition.venue?.fullName || null,
        attendance: competition.attendance || null
      };
      
      const { error } = await supabase
        .from('games')
        .upsert(gameData, { onConflict: 'id' });
        
      if (!error) {
        this.gamesCollected++;
      }
      
    } catch (error) {
      // Silently skip individual game errors
    }
  }
  
  private async ensureTeam(sport: string, teamData: any) {
    const team = {
      id: parseInt(teamData.id),
      name: teamData.displayName,
      city: teamData.displayName.split(' ').slice(0, -1).join(' '),
      abbreviation: teamData.abbreviation,
      sport_id: sport,
      league_id: sport.toUpperCase()
    };
    
    await supabase
      .from('teams')
      .upsert(team, { onConflict: 'id' });
  }
}

// Run the collector
const collector = new RealSportsCollector();
collector.collectAll().catch(console.error);