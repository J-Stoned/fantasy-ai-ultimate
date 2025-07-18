#!/usr/bin/env tsx
import { InMemoryCache } from './utils/memory-cache';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testCache() {
  console.log(chalk.cyan('Testing cache loading...\n'));
  
  const cache = new InMemoryCache();
  await cache.initialize();
  
  const stats = cache.getStats();
  console.log(chalk.yellow('Cache stats:'));
  console.log(chalk.white(`  Teams: ${stats.teams}`));
  console.log(chalk.white(`  Players: ${stats.players}`));
  console.log(chalk.white(`  Games: ${stats.games}\n`));
  
  // Test specific player lookups
  const testIds = [
    'espn_nfl_4040761', // Devin Singletary
    'espn_nfl_3049916', // Matt Breida
    'espn_nfl_3128724'  // Isaiah McKenzie
  ];
  
  console.log(chalk.yellow('Testing player lookups:'));
  for (const id of testIds) {
    const player = cache.getPlayerByExternalId(id);
    console.log(chalk.white(`  ${id}: ${player ? player.name : 'NOT FOUND'}`));
  }
  
  // Check how many NFL players have external IDs
  let nflPlayersWithIds = 0;
  let nflPlayersWithoutIds = 0;
  
  // Access the private map through serialization
  const serialized = cache.serialize();
  const players = new Map(serialized.players);
  
  players.forEach(player => {
    if (player.sport === 'NFL') {
      if (player.external_id) {
        nflPlayersWithIds++;
      } else {
        nflPlayersWithoutIds++;
      }
    }
  });
  
  console.log(chalk.yellow('\nNFL Players:'));
  console.log(chalk.white(`  With external IDs: ${nflPlayersWithIds}`));
  console.log(chalk.white(`  Without external IDs: ${nflPlayersWithoutIds}`));
}

testCache().catch(console.error);