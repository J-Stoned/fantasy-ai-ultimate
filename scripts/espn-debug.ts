#!/usr/bin/env tsx
/**
 * ESPN API DEBUGGER - Find the correct structure
 */

import axios from 'axios';

async function debugESPNStructure() {
  console.log('🔍 ESPN API STRUCTURE DEBUGGER\n');
  
  try {
    // Get a recent game
    const scoreboard = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
    );
    
    const game = scoreboard.data.events?.[0];
    if (!game) {
      console.log('No games found');
      return;
    }
    
    console.log(`Game: ${game.name}`);
    console.log(`ID: ${game.id}`);
    console.log(`Status: ${game.status.type.name}\n`);
    
    // Get the summary
    const summary = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
    );
    
    // Log the entire structure
    console.log('Summary keys:', Object.keys(summary.data));
    console.log('\nBoxscore keys:', Object.keys(summary.data.boxscore || {}));
    
    if (summary.data.boxscore) {
      console.log('\nBoxscore structure:');
      console.log(JSON.stringify(summary.data.boxscore, null, 2).substring(0, 2000));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugESPNStructure();