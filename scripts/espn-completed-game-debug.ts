#!/usr/bin/env tsx
/**
 * ESPN COMPLETED GAME DEBUGGER
 */

import axios from 'axios';

async function debugCompletedGame() {
  console.log('🔍 ESPN COMPLETED GAME STRUCTURE\n');
  
  try {
    // Get week 18 completed games
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=18'
    );
    
    const completedGame = response.data.events?.find((e: any) => 
      e.status.type.completed === true
    );
    
    if (!completedGame) {
      console.log('No completed games found in week 18');
      return;
    }
    
    console.log(`Game: ${completedGame.name}`);
    console.log(`ID: ${completedGame.id}`);
    console.log(`Status: ${completedGame.status.type.name}`);
    console.log(`Score: ${completedGame.competitions[0].competitors[0].score} - ${completedGame.competitions[0].competitors[1].score}\n`);
    
    // Get the summary
    const summary = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${completedGame.id}`
    );
    
    // Check different paths for player data
    console.log('Checking for player data...\n');
    
    // Path 1: boxscore.players
    if (summary.data.boxscore?.players) {
      console.log('✅ Found boxscore.players');
      const firstTeam = summary.data.boxscore.players[0];
      console.log('First team:', firstTeam.team.displayName);
      console.log('Statistics type:', typeof firstTeam.statistics);
      console.log('Statistics value:', JSON.stringify(firstTeam.statistics).substring(0, 500));
    }
    
    // Path 2: boxscore.teams[].statistics
    if (summary.data.boxscore?.teams?.[0]?.statistics) {
      console.log('\n✅ Found boxscore.teams[].statistics');
      const stats = summary.data.boxscore.teams[0].statistics;
      console.log('Statistics keys:', Object.keys(stats));
      console.log('First few entries:', JSON.stringify(stats).substring(0, 500));
    }
    
    // Path 3: Check for playerParticipation
    if (summary.data.playerParticipation) {
      console.log('\n✅ Found playerParticipation');
      console.log('Keys:', Object.keys(summary.data.playerParticipation));
    }
    
    // Path 4: Check plays for player info
    if (summary.data.plays) {
      console.log('\n✅ Found plays data');
      console.log('Number of plays:', summary.data.plays.length);
    }
    
    // Path 5: Check for stats in other locations
    console.log('\n📊 All summary data keys:');
    for (const key of Object.keys(summary.data)) {
      const value = summary.data[key];
      if (value && typeof value === 'object') {
        console.log(`- ${key}: ${Array.isArray(value) ? `Array(${value.length})` : 'Object'}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

debugCompletedGame();