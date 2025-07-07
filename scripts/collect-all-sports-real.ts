#!/usr/bin/env tsx
/**
 * Collect REAL data for ALL sports: NFL, NBA, MLB, NHL, NCAA
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

class AllSportsCollector {
  private stats = {
    nfl: { games: 0, teams: 0 },
    nba: { games: 0, teams: 0 },
    mlb: { games: 0, teams: 0 },
    nhl: { games: 0, teams: 0 },
    ncaaf: { games: 0, teams: 0 },
    ncaab: { games: 0, teams: 0 }
  };
  
  async collectAll() {
    console.log(chalk.blue.bold('🏆 COLLECTING REAL DATA FOR ALL SPORTS\n'));
    
    // Clear fake data first
    await this.clearFakeData();
    
    // Collect each sport
    await this.collectNFL();
    await this.collectNBA();
    await this.collectMLB();
    await this.collectNHL();
    await this.collectNCAAF();
    await this.collectNCAAB();
    
    // Summary
    this.showSummary();
  }
  
  private async clearFakeData() {
    console.log(chalk.yellow('Clearing fake/future games...'));
    
    const { count } = await supabase
      .from('games')
      .delete()
      .gt('start_time', new Date().toISOString())
      .not('id', 'is', null);
      
    if (count) {
      console.log(chalk.green(`   ✓ Deleted ${count} future games`));
    }
  }
  
  private async collectNFL() {
    console.log(chalk.cyan('\n🏈 NFL 2024 Season...'));
    
    // Weeks 1-17 of 2024 regular season
    for (let week = 1; week <= 17; week++) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`
        );
        
        await this.processGames('nfl', response.data.events || [], week);
        
      } catch (error) {
        console.error(chalk.red(`   Week ${week} failed`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(chalk.green(`   ✓ Collected ${this.stats.nfl.games} NFL games`));
  }
  
  private async collectNBA() {
    console.log(chalk.cyan('\n🏀 NBA 2024-25 Season...'));
    
    // Get games from Oct 2024 - Jan 2025
    const months = [
      { month: 'October', dates: '20241022-20241031' },
      { month: 'November', dates: '20241101-20241130' },
      { month: 'December', dates: '20241201-20241231' },
      { month: 'January', dates: '20250101-20250131' }
    ];
    
    for (const period of months) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${period.dates}`
        );
        
        await this.processGames('nba', response.data.events || []);
        console.log(`   ${period.month}: ${response.data.events?.filter((e: any) => e.status.type.completed).length || 0} games`);
        
      } catch (error) {
        console.error(chalk.red(`   ${period.month} failed`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(chalk.green(`   ✓ Collected ${this.stats.nba.games} NBA games`));
  }
  
  private async collectMLB() {
    console.log(chalk.cyan('\n⚾ MLB 2024 Season...'));
    
    // Sample dates throughout the season
    const sampleDates = [
      '20240328', '20240415', '20240501', '20240515', '20240601', 
      '20240615', '20240701', '20240715', '20240801', '20240815',
      '20240901', '20240915', '20241001'
    ];
    
    for (const date of sampleDates) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`
        );
        
        await this.processGames('mlb', response.data.events || []);
        
      } catch (error) {
        // Skip errors
      }
      
      process.stdout.write(`\r   Collected ${this.stats.mlb.games} games...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(chalk.green(`\n   ✓ Collected ${this.stats.mlb.games} MLB games`));
  }
  
  private async collectNHL() {
    console.log(chalk.cyan('\n🏒 NHL 2024-25 Season...'));
    
    // Get games from Oct 2024 - Jan 2025
    const months = [
      { month: 'October', dates: '20241008-20241031' },
      { month: 'November', dates: '20241101-20241130' },
      { month: 'December', dates: '20241201-20241231' },
      { month: 'January', dates: '20250101-20250131' }
    ];
    
    for (const period of months) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${period.dates}`
        );
        
        await this.processGames('nhl', response.data.events || []);
        console.log(`   ${period.month}: ${response.data.events?.filter((e: any) => e.status.type.completed).length || 0} games`);
        
      } catch (error) {
        console.error(chalk.red(`   ${period.month} failed`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(chalk.green(`   ✓ Collected ${this.stats.nhl.games} NHL games`));
  }
  
  private async collectNCAAF() {
    console.log(chalk.cyan('\n🏈 NCAA Football 2024...'));
    
    // Sample weeks from the season
    for (let week = 1; week <= 15; week += 2) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&week=${week}&dates=2024`
        );
        
        await this.processGames('ncaaf', response.data.events || [], week);
        
      } catch (error) {
        // Skip errors
      }
      
      process.stdout.write(`\r   Collected ${this.stats.ncaaf.games} games...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(chalk.green(`\n   ✓ Collected ${this.stats.ncaaf.games} NCAA Football games`));
  }
  
  private async collectNCAAB() {
    console.log(chalk.cyan('\n🏀 NCAA Basketball 2024-25...'));
    
    // Sample dates from the season
    const sampleDates = [
      '20241104', '20241115', '20241201', '20241215',
      '20250101', '20250115'
    ];
    
    for (const date of sampleDates) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=${date}`
        );
        
        await this.processGames('ncaab', response.data.events || []);
        
      } catch (error) {
        // Skip errors
      }
      
      process.stdout.write(`\r   Collected ${this.stats.ncaab.games} games...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(chalk.green(`\n   ✓ Collected ${this.stats.ncaab.games} NCAA Basketball games`));
  }
  
  private async processGames(sport: string, events: any[], week?: number) {
    for (const event of events) {
      try {
        // Only save completed games
        if (!event.status?.type?.completed) continue;
        
        const competition = event.competitions?.[0];
        if (!competition) continue;
        
        const home = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const away = competition.competitors?.find((c: any) => c.homeAway === 'away');
        
        if (!home || !away) continue;
        
        // Ensure teams exist
        await this.ensureTeam(sport, home.team);
        await this.ensureTeam(sport, away.team);
        
        // Save game
        const gameData = {
          id: parseInt(event.id),
          sport_id: sport,
          season: new Date(event.date).getFullYear(),
          season_type: 2, // Regular season
          week: week || null,
          start_time: event.date,
          status: 'completed',
          home_team_id: parseInt(home.team.id),
          away_team_id: parseInt(away.team.id),
          home_score: parseInt(home.score || 0),
          away_score: parseInt(away.score || 0),
          venue: competition.venue?.fullName || null,
          attendance: competition.attendance || null
        };
        
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'id' });
          
        if (!error) {
          this.stats[sport as keyof typeof this.stats].games++;
        }
        
      } catch (error) {
        // Skip individual game errors
      }
    }
  }
  
  private async ensureTeam(sport: string, teamData: any) {
    // Check if team already exists
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('id', parseInt(teamData.id))
      .single();
      
    if (!existing) {
      const team = {
        id: parseInt(teamData.id),
        name: teamData.displayName,
        city: teamData.location || teamData.displayName.split(' ').slice(0, -1).join(' '),
        abbreviation: teamData.abbreviation,
        sport_id: sport,
        league_id: sport.toUpperCase(),
        logo_url: teamData.logos?.[0]?.href || null,
        metadata: {
          color: teamData.color,
          alternateColor: teamData.alternateColor,
          mascot: teamData.nickname
        }
      };
      
      await supabase
        .from('teams')
        .upsert(team, { onConflict: 'id' });
        
      this.stats[sport as keyof typeof this.stats].teams++;
    }
  }
  
  private showSummary() {
    console.log(chalk.green.bold('\n\n✅ COLLECTION COMPLETE!\n'));
    console.log(chalk.white('Games collected by sport:'));
    
    let totalGames = 0;
    let totalTeams = 0;
    
    Object.entries(this.stats).forEach(([sport, stats]) => {
      if (stats.games > 0) {
        console.log(`  ${sport.toUpperCase()}: ${stats.games} games, ${stats.teams} new teams`);
        totalGames += stats.games;
        totalTeams += stats.teams;
      }
    });
    
    console.log(chalk.cyan(`\nTOTAL: ${totalGames} real games, ${totalTeams} new teams`));
    console.log(chalk.yellow('\nYou now have REAL sports data to analyze!'));
    
    // Show sample
    this.showSampleGames();
  }
  
  private async showSampleGames() {
    console.log(chalk.blue('\nSample of real games:'));
    
    for (const sport of ['nfl', 'nba', 'mlb', 'nhl']) {
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', sport)
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();
        
      if (game) {
        const { data: home } = await supabase
          .from('teams')
          .select('abbreviation')
          .eq('id', game.home_team_id)
          .single();
          
        const { data: away } = await supabase
          .from('teams')
          .select('abbreviation')
          .eq('id', game.away_team_id)
          .single();
          
        const date = new Date(game.start_time).toLocaleDateString();
        console.log(`  ${sport.toUpperCase()}: ${date} - ${away?.abbreviation} @ ${home?.abbreviation} (${game.away_score}-${game.home_score})`);
      }
    }
  }
}

// Run the collector
const collector = new AllSportsCollector();
collector.collectAll().catch(console.error);