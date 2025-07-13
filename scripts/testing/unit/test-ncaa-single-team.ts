#!/usr/bin/env tsx
/**
 * 🧪 TEST NCAA COLLECTOR WITH SINGLE TEAM
 * Use this to verify data collection works before running full collectors
 */

import { NCAAMasterCollector } from './collectors/ncaa-master-collector';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class SingleTeamTestCollector extends NCAAMasterCollector {
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🧪 SINGLE TEAM TEST COLLECTION\n'));
    
    try {
      // Test with just one team - let user specify sport
      const sport = process.argv[2] as 'football' | 'basketball' | 'baseball' || 'football';
      
      const testTeams = {
        football: { id: '57', name: 'Georgia', conf: 'SEC' },
        basketball: { id: '150', name: 'Duke', conf: 'ACC' },
        baseball: { id: '99', name: 'LSU', conf: 'SEC' }
      };
      
      const testTeam = testTeams[sport];
      console.log(chalk.yellow(`Testing ${sport} with team: ${testTeam.name}\n`));
      
      // Collect roster for this team
      await this.collectTeamRoster(testTeam, sport);
      
      this.printStats();
      
      // Verify data was stored
      await this.verifyDataStored();
      
    } catch (error) {
      console.error(chalk.red('Test failed:'), error);
    } finally {
      this.cleanup();
    }
  }
  
  /**
   * Make collectTeamRoster public for testing
   */
  public async collectTeamRoster(
    team: { id: string; name: string; conf: string },
    sport: 'football' | 'basketball' | 'baseball'
  ): Promise<void> {
    return super.collectTeamRoster(team, sport);
  }
  
  /**
   * Verify data was actually stored in database
   */
  private async verifyDataStored(): Promise<void> {
    console.log(chalk.yellow('\n\n📊 VERIFYING DATABASE STORAGE:\n'));
    
    // Check teams
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, name, sport_id')
      .eq('name', 'Georgia')
      .eq('sport_id', 'ncaa_football');
    
    if (teams && teams.length > 0) {
      console.log(chalk.green(`✅ Team found in database:`));
      console.log(chalk.white(`   ID: ${teams[0].id}, Name: ${teams[0].name}`));
      
      // Check players for this team
      const { data: players, error: playerError } = await supabase
        .from('players')
        .select('id, firstname, lastname, external_id, position')
        .eq('team_id', teams[0].id)
        .limit(5);
      
      if (players && players.length > 0) {
        console.log(chalk.green(`\n✅ Players found for team: ${players.length} players`));
        players.forEach(p => {
          console.log(chalk.white(`   ${p.firstname} ${p.lastname} - ${p.position.join('/')}`));
        });
      } else {
        console.log(chalk.red(`\n❌ No players found for team!`));
      }
    } else {
      console.log(chalk.red(`❌ Team not found in database!`));
    }
    
    // Check total counts
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', 'espn_ncaa_football_%');
    
    console.log(chalk.yellow(`\n📈 Total NCAA football players in database: ${totalPlayers}`));
  }
}

// Run the test
async function runTest() {
  console.log(chalk.bold.cyan('🧪 Starting Single Team Test...'));
  console.log(chalk.cyan('This will test collecting one team to verify everything works\n'));
  
  // First run schema verification
  console.log(chalk.yellow('Running schema verification first...\n'));
  const { exec } = require('child_process');
  
  exec('npx tsx scripts/database/verify-schema-before-collection.ts', (error: any, stdout: string, stderr: string) => {
    if (error) {
      console.error(chalk.red('Schema verification failed!'), error);
      process.exit(1);
    }
    
    console.log(stdout);
    
    if (stdout.includes('DATABASE SCHEMA IS COMPATIBLE')) {
      console.log(chalk.green('\n✅ Schema verified! Running test...\n'));
      
      const collector = new SingleTeamTestCollector();
      
      collector.collect()
        .then(() => {
          console.log(chalk.green('\n✅ Test completed successfully!'));
          console.log(chalk.cyan('If data was stored correctly, you can run the full collectors.\n'));
        })
        .catch(error => {
          console.error(chalk.red('\n❌ Test failed:'), error);
          process.exit(1);
        });
    } else {
      console.error(chalk.red('Schema verification failed!'));
      process.exit(1);
    }
  });
}

// Execute
runTest();