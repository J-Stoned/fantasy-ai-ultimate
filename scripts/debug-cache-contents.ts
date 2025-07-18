#!/usr/bin/env tsx
import { InMemoryCache } from './utils/memory-cache';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugCacheContents() {
  console.log(chalk.cyan('🔍 Debugging cache contents...\n'));
  
  const cache = new InMemoryCache();
  await cache.initialize();
  
  const stats = cache.getStats();
  console.log(chalk.white(`Cache stats: ${stats.teams} teams, ${stats.players} players\n`));
  
  // Check specific NFL team lookups
  const testTeamIds = ['23', '21', '22', '10', '20']; // Steelers, Eagles, Cardinals, Titans, Jets
  
  console.log(chalk.cyan('Testing specific team lookups:'));
  testTeamIds.forEach(id => {
    const externalId = `espn_nfl_${id}`;
    const team = cache.getTeamByExternalId(externalId);
    
    if (team) {
      console.log(chalk.green(`✅ ${externalId} → ${team.name} (ID: ${team.id})`));
    } else {
      console.log(chalk.red(`❌ ${externalId} → NOT FOUND`));
    }
  });
  
  // Get all NFL teams from cache
  console.log(chalk.cyan('\nAll NFL teams in cache:'));
  const serialized = cache.serialize();
  const teams = new Map(serialized.teams);
  
  const nflTeams = Array.from(teams.values()).filter(team => team.sport === 'NFL');
  console.log(chalk.white(`Found ${nflTeams.length} NFL teams in cache:`));
  
  nflTeams.forEach(team => {
    console.log(chalk.gray(`  ${team.name} - ${team.external_id}`));
  });
  
  // Check the external_id index
  console.log(chalk.cyan('\nTesting external_id index:'));
  const teamsByExternalId = new Map(serialized.teamsByExternalId);
  
  testTeamIds.forEach(id => {
    const externalId = `espn_nfl_${id}`;
    const team = teamsByExternalId.get(externalId);
    
    if (team) {
      console.log(chalk.green(`✅ Index: ${externalId} → ${team.name}`));
    } else {
      console.log(chalk.red(`❌ Index: ${externalId} → NOT FOUND`));
    }
  });
}

debugCacheContents().catch(console.error);