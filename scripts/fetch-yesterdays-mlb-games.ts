#!/usr/bin/env node
import axios from 'axios';

// MLB API setup (from operational manual)
const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function fetchYesterdaysMLBGames() {
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateString = yesterday.toISOString().split('T')[0];
  
  console.log(`⚾ Fetching MLB games for ${dateString}...\n`);
  
  try {
    // Get schedule for yesterday
    const response = await mlbApi.get('/schedule', {
      params: {
        sportId: 1, // MLB
        startDate: dateString,
        endDate: dateString
      }
    });
    
    if (!response.data.dates || response.data.dates.length === 0) {
      console.log('No games found for yesterday.');
      return;
    }
    
    // Extract games from the response
    const games = response.data.dates[0].games || [];
    console.log(`Found ${games.length} MLB games:\n`);
    
    // Display game information
    games.forEach((game, index) => {
      const homeTeam = game.teams.home.team.name;
      const awayTeam = game.teams.away.team.name;
      const homeScore = game.teams.home.score || 0;
      const awayScore = game.teams.away.score || 0;
      const status = game.status.detailedState;
      const venue = game.venue.name;
      
      console.log(`${index + 1}. ${awayTeam} @ ${homeTeam}`);
      console.log(`   Score: ${awayScore} - ${homeScore}`);
      console.log(`   Status: ${status}`);
      console.log(`   Venue: ${venue}`);
      
      // Add winning pitcher if available
      if (game.decisions?.winner) {
        console.log(`   Winning Pitcher: ${game.decisions.winner.fullName}`);
      }
      if (game.decisions?.loser) {
        console.log(`   Losing Pitcher: ${game.decisions.loser.fullName}`);
      }
      
      console.log('');
    });
    
    // Summary statistics
    const completedGames = games.filter(g => g.status.abstractGameState === 'Final').length;
    console.log(`Summary: ${completedGames} games completed, ${games.length - completedGames} in progress or postponed`);
    
  } catch (error) {
    console.error('Error fetching MLB games:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
    }
  }
}

// Run the function
fetchYesterdaysMLBGames();