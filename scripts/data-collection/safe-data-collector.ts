#!/usr/bin/env tsx
/**
 * Safe Data Collector
 * Properly handles errors and validates data before insertion
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

class SafeDataCollector {
  private stats = {
    attempted: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  private teamCache = new Map<number, boolean>();
  
  async collectSafely() {
    console.log(chalk.blue.bold('🛡️ SAFE DATA COLLECTION\n'));
    console.log(chalk.yellow('This collector validates all data before insertion\n'));
    
    // Pre-load team cache
    await this.loadTeamCache();
    
    // Collect with proper error handling
    await this.collectNFLGames();
    
    // Show results
    this.showResults();
  }
  
  private async loadTeamCache() {
    console.log(chalk.cyan('Loading team cache...'));
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id');
    
    if (teams) {
      teams.forEach(team => {
        this.teamCache.set(team.id, true);
      });
      console.log(chalk.green(`  ✓ Loaded ${teams.length} teams\n`));
    }
  }
  
  private async collectNFLGames() {
    console.log(chalk.yellow('Collecting NFL games with validation...'));
    
    // Get recent week
    try {
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=18&dates=2024'
      );
      
      const events = response.data.events || [];
      
      for (const event of events) {
        await this.processGame('nfl', event);
      }
      
    } catch (error: any) {
      this.logError('API fetch failed', error.message);
    }
  }
  
  private async processGame(sport: string, event: any) {
    this.stats.attempted++;
    
    try {
      // Validate event structure
      if (!event.competitions || !event.competitions[0]) {
        throw new Error('Invalid event structure');
      }
      
      const comp = event.competitions[0];
      const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
      
      // Validate teams exist
      if (!home || !away) {
        throw new Error('Missing home or away team');
      }
      
      const homeId = parseInt(home.team.id);
      const awayId = parseInt(away.team.id);
      
      // Validate team IDs are numbers
      if (isNaN(homeId) || isNaN(awayId)) {
        throw new Error('Invalid team IDs');
      }
      
      // Check if teams exist in database
      if (!this.teamCache.has(homeId)) {
        await this.createTeam(home.team, sport);
      }
      
      if (!this.teamCache.has(awayId)) {
        await this.createTeam(away.team, sport);
      }
      
      // Validate scores
      const homeScore = parseInt(home.score) || 0;
      const awayScore = parseInt(away.score) || 0;
      
      // Check if game is actually completed
      if (!event.status?.type?.completed) {
        throw new Error('Game not completed');
      }
      
      // Prepare game data with validation
      const gameData = {
        home_team_id: homeId,
        away_team_id: awayId,
        sport_id: sport,
        start_time: event.date || new Date().toISOString(),
        venue: comp.venue?.fullName || 'Unknown Venue',
        home_score: homeScore,
        away_score: awayScore,
        status: 'completed',
        external_id: `${sport}_${event.id}`,
        metadata: {
          week: comp.week || null,
          season: new Date(event.date).getFullYear(),
          validated: true
        }
      };
      
      // Validate required fields
      if (!gameData.external_id || !gameData.start_time) {
        throw new Error('Missing required fields');
      }
      
      // Insert with proper error handling
      const { data, error } = await supabase
        .from('games')
        .upsert(gameData, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.stats.successful++;
      console.log(chalk.green(`  ✓ Game saved: ${away.team.abbreviation} @ ${home.team.abbreviation} (${awayScore}-${homeScore})`));
      
    } catch (error: any) {
      this.stats.failed++;
      this.logError(`Game ${event.id}`, error.message);
    }
  }
  
  private async createTeam(teamData: any, sport: string) {
    try {
      const teamId = parseInt(teamData.id);
      
      const team = {
        id: teamId,
        name: teamData.displayName || teamData.name || `Team ${teamId}`,
        abbreviation: teamData.abbreviation || `T${teamId}`,
        location: teamData.location || '',
        sport: sport,
        espn_id: teamData.id
      };
      
      const { error } = await supabase
        .from('teams')
        .upsert(team, { onConflict: 'id' });
      
      if (!error) {
        this.teamCache.set(teamId, true);
        console.log(chalk.blue(`    + Created team: ${team.name}`));
      }
      
    } catch (error: any) {
      this.logError('Team creation', error.message);
    }
  }
  
  private logError(context: string, message: string) {
    const errorMsg = `${context}: ${message}`;
    this.stats.errors.push(errorMsg);
    console.log(chalk.red(`  ✗ ${errorMsg}`));
  }
  
  private showResults() {
    console.log(chalk.blue.bold('\n📊 COLLECTION RESULTS\n'));
    
    console.log(`Attempted: ${this.stats.attempted}`);
    console.log(chalk.green(`Successful: ${this.stats.successful}`));
    console.log(chalk.red(`Failed: ${this.stats.failed}`));
    
    if (this.stats.errors.length > 0) {
      console.log(chalk.yellow('\nErrors encountered:'));
      
      // Group errors
      const errorCounts = new Map<string, number>();
      this.stats.errors.forEach(error => {
        const key = error.split(':')[1]?.trim() || error;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      });
      
      errorCounts.forEach((count, error) => {
        console.log(`  - ${error}: ${count} times`);
      });
    }
    
    console.log(chalk.cyan('\n✅ Data collection complete with proper validation!'));
  }
}

// Additional helper to test database constraints
async function testDatabaseConstraints() {
  console.log(chalk.blue.bold('\n🧪 TESTING DATABASE CONSTRAINTS\n'));
  
  // Test 1: Try to insert game with non-existent team
  console.log(chalk.yellow('Test 1: Insert game with invalid team...'));
  
  const { error: test1Error } = await supabase
    .from('games')
    .insert({
      home_team_id: 99999,
      away_team_id: 99998,
      sport_id: 'test',
      start_time: new Date().toISOString(),
      venue: 'Test Stadium',
      home_score: 0,
      away_score: 0,
      status: 'test',
      external_id: 'test_constraint_check'
    });
  
  if (test1Error) {
    console.log(chalk.green('  ✓ Constraint working: ' + test1Error.message));
  } else {
    console.log(chalk.red('  ✗ Constraint NOT working - invalid teams accepted!'));
  }
  
  // Clean up test data
  await supabase
    .from('games')
    .delete()
    .eq('external_id', 'test_constraint_check');
}

// Run the safe collector
const collector = new SafeDataCollector();
collector.collectSafely()
  .then(() => testDatabaseConstraints())
  .catch(console.error);