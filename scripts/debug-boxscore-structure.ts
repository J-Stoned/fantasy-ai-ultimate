#!/usr/bin/env tsx
/**
 * Debug boxscore structure
 */

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('espn-boxscore-sample.json', 'utf8'));

console.log('=== CHECKING BOTH STRUCTURES ===\n');
console.log('boxscore.teams exists?', !!data.boxscore.teams);
console.log('boxscore.teams length:', data.boxscore.teams?.length);
console.log('boxscore.players exists?', !!data.boxscore.players);
console.log('boxscore.players length:', data.boxscore.players?.length);

// Check teams structure
if (data.boxscore.teams?.[0]) {
  const team = data.boxscore.teams[0];
  console.log('\nTeam 0:', team.team?.displayName);
  console.log('  statistics?', !!team.statistics);
  console.log('  statistics length:', team.statistics?.length);
  
  // Check what's in statistics
  team.statistics?.forEach((stat: any, idx: number) => {
    console.log(`  Stat ${idx}: ${stat.name || 'unnamed'}, has athletes? ${!!stat.athletes}`);
  });
}

// Check players structure
if (data.boxscore.players?.[0]) {
  const player = data.boxscore.players[0];
  console.log('\nPlayer entry 0:');
  console.log('  Team:', player.team?.displayName);
  console.log('  Statistics:', player.statistics?.length);
  
  if (player.statistics?.[0]) {
    console.log('  First stat has athletes?', !!player.statistics[0].athletes);
    console.log('  Athletes count:', player.statistics[0].athletes?.length);
  }
}