#!/usr/bin/env tsx
/**
 * Aligned Data Collector - Ensures all data properly fits our schema
 * This collector checks column types and constraints before inserting
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

class AlignedDataCollector {
  private stats = {
    games: 0,
    teams: 0,
    players: 0,
    errors: 0
  };
  
  async collectWithAlignment() {
    console.log(chalk.blue.bold('🎯 ALIGNED DATA COLLECTION\n'));
    console.log(chalk.yellow('This collector ensures all data fits our schema properly\n'));
    
    // First ensure foundation tables are filled
    await this.ensureFoundationData();
    
    // Then collect games with proper validation
    await this.collectValidatedGames();
    
    // Show results
    this.showResults();
  }
  
  private async ensureFoundationData() {
    console.log(chalk.cyan('Checking foundation data...'));
    
    // Check if sports table has data
    const { count: sportsCount } = await supabase
      .from('sports')
      .select('*', { count: 'exact', head: true });
    
    if (!sportsCount || sportsCount === 0) {
      console.log(chalk.red('  ✗ Sports table empty - run fill-foundation-tables.ts first'));
      process.exit(1);
    }
    
    console.log(chalk.green('  ✓ Foundation data exists'));
  }
  
  private async collectValidatedGames() {
    console.log(chalk.cyan('\nCollecting games with validation...'));
    
    // NFL example - can be extended to other sports
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=1&dates=2024'
    );
    
    const events = response.data.events || [];
    
    for (const event of events) {
      if (!event.status?.type?.completed) continue;
      
      const comp = event.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!home || !away) continue;
      
      // First ensure teams exist with proper data
      await this.ensureTeam(home.team, 'nfl');
      await this.ensureTeam(away.team, 'nfl');
      
      // Then save game with validated data
      const gameData = this.validateGameData({
        home_team_id: parseInt(home.team.id),
        away_team_id: parseInt(away.team.id),
        sport_id: 'nfl',
        start_time: event.date,
        venue: comp.venue?.fullName || 'Unknown Venue',
        home_score: parseInt(home.score) || 0,
        away_score: parseInt(away.score) || 0,
        status: 'completed',
        external_id: `nfl_${event.id}`,
        metadata: {
          week: 1,
          season: 2024,
          attendance: comp.attendance,
          weather: comp.weather
        }
      });
      
      if (gameData) {
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'external_id' });
        
        if (!error) {
          this.stats.games++;
          console.log(`  ✓ Game saved: ${away.team.abbreviation} @ ${home.team.abbreviation}`);
        } else {
          this.stats.errors++;
          console.log(chalk.red(`  ✗ Error: ${error.message}`));
        }
      }
    }
  }
  
  private async ensureTeam(teamData: any, sport: string) {
    // Check if team exists in teams table
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('id', parseInt(teamData.id))
      .single();
    
    if (!existing) {
      // Create team with proper data
      const team = {
        id: parseInt(teamData.id),
        name: teamData.displayName || teamData.name,
        abbreviation: teamData.abbreviation,
        location: teamData.location || '',
        sport: sport,
        espn_id: teamData.id
      };
      
      const { error } = await supabase
        .from('teams')
        .insert(team);
      
      if (!error) {
        this.stats.teams++;
      }
    }
    
    // Also ensure team exists in teams_master
    const { data: masterExists } = await supabase
      .from('teams_master')
      .select('id')
      .eq('id', parseInt(teamData.id))
      .single();
    
    if (!masterExists) {
      const teamMaster = {
        id: parseInt(teamData.id),
        name: teamData.displayName || teamData.name,
        abbreviation: teamData.abbreviation,
        location: teamData.location || '',
        league_id: sport,
        sport_id: sport,
        external_ids: { espn: teamData.id },
        is_active: true
      };
      
      await supabase
        .from('teams_master')
        .insert(teamMaster);
    }
  }
  
  private validateGameData(data: any): any {
    // Validate required fields
    if (!data.home_team_id || !data.away_team_id) {
      console.log(chalk.red('  ✗ Missing team IDs'));
      return null;
    }
    
    if (!data.start_time) {
      console.log(chalk.red('  ✗ Missing start time'));
      return null;
    }
    
    // Ensure scores are numbers
    data.home_score = parseInt(data.home_score) || 0;
    data.away_score = parseInt(data.away_score) || 0;
    
    // Validate sport_id is in our sports table
    const validSports = ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab'];
    if (!validSports.includes(data.sport_id)) {
      console.log(chalk.red(`  ✗ Invalid sport_id: ${data.sport_id}`));
      return null;
    }
    
    // Ensure metadata is JSON
    if (data.metadata && typeof data.metadata === 'object') {
      // Clean metadata
      data.metadata = JSON.parse(JSON.stringify(data.metadata));
    }
    
    return data;
  }
  
  private showResults() {
    console.log(chalk.green.bold('\n✅ ALIGNED COLLECTION COMPLETE!\n'));
    console.log(`Games collected: ${this.stats.games}`);
    console.log(`Teams created: ${this.stats.teams}`);
    console.log(`Players created: ${this.stats.players}`);
    console.log(`Errors: ${this.stats.errors}`);
    
    if (this.stats.errors > 0) {
      console.log(chalk.yellow('\nSome errors occurred - check data constraints'));
    }
  }
}

// Add helper to show current schema info
async function showSchemaInfo() {
  console.log(chalk.blue.bold('\n📋 CURRENT SCHEMA INFO:\n'));
  
  // Check what columns games table actually has
  const { data: gameColumns } = await supabase
    .from('games')
    .select('*')
    .limit(0);
  
  if (gameColumns) {
    console.log('Games table columns:', Object.keys(gameColumns));
  }
  
  // Show sample game structure
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleGame) {
    console.log('\nSample game structure:');
    console.log(JSON.stringify(sampleGame, null, 2));
  }
}

// Run the aligned collector
const collector = new AlignedDataCollector();
showSchemaInfo()
  .then(() => collector.collectWithAlignment())
  .catch(console.error);