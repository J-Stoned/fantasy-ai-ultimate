#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import axios from 'axios';
import chalk from 'chalk';

async function findESPNIds() {
  console.log(chalk.cyan('🔍 Finding ESPN IDs for games...'));

  // Get games without ESPN IDs
  const { data: gamesWithoutIds } = await enhancedDb.getClient()
    .from('games')
    .select('id, sport, home_team_id, away_team_id, start_time')
    .or('external_id.is.null,not.external_id.like.espn_%')
    .in('sport', ['NBA', 'MLB'])
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(500);

  console.log(chalk.yellow(`Found ${gamesWithoutIds?.length || 0} games without ESPN IDs`));

  if (!gamesWithoutIds || gamesWithoutIds.length === 0) return;

  // Get ESPN games from last 60 days
  const allESPNGames: any[] = [];
  const sports = [
    { name: 'NBA', endpoint: 'basketball/nba' },
    { name: 'MLB', endpoint: 'baseball/mlb' }
  ];

  for (const sport of sports) {
    console.log(chalk.cyan(`\nFetching ${sport.name} games from ESPN...`));
    
    try {
      // Get current games
      const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport.endpoint}/scoreboard`;
      const response = await axios.get(scoreboardUrl);
      const events = response.data.events || [];
      
      events.forEach((event: any) => {
        allESPNGames.push({
          espnId: event.id,
          sport: sport.name,
          date: new Date(event.date),
          homeTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home'),
          awayTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away')
        });
      });

      // Get games from past dates
      for (let daysAgo = 1; daysAgo <= 60; daysAgo++) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        
        try {
          const historicalUrl = `${scoreboardUrl}?dates=${dateStr}`;
          const histResponse = await axios.get(historicalUrl, { timeout: 5000 });
          const histEvents = histResponse.data.events || [];
          
          histEvents.forEach((event: any) => {
            allESPNGames.push({
              espnId: event.id,
              sport: sport.name,
              date: new Date(event.date),
              homeTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home'),
              awayTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away')
            });
          });
          
          if (daysAgo % 10 === 0) {
            console.log(chalk.gray(`  Fetched ${sport.name} games up to ${daysAgo} days ago`));
          }
        } catch (error) {
          // Skip errors for historical dates
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error fetching ${sport.name} games:`, error));
    }
  }

  console.log(chalk.green(`\n✅ Found ${allESPNGames.length} ESPN games total`));

  // Match games
  let matched = 0;
  for (const game of gamesWithoutIds) {
    const gameDate = new Date(game.start_time);
    const gameDateStr = gameDate.toDateString();
    
    // Find matching ESPN game
    const espnMatch = allESPNGames.find(espnGame => {
      if (espnGame.sport !== game.sport) return false;
      if (espnGame.date.toDateString() !== gameDateStr) return false;
      
      // For now, just match by date and sport (could improve with team matching)
      return true;
    });

    if (espnMatch) {
      const external_id = `espn_${espnMatch.sport.toLowerCase()}_${espnMatch.espnId}`;
      
      await enhancedDb.getClient()
        .from('games')
        .update({ external_id })
        .eq('id', game.id);
      
      matched++;
      console.log(chalk.green(`✅ Updated game ${game.id} with ESPN ID: ${external_id}`));
    }
  }

  console.log(chalk.bold.green(`\n✅ Matched ${matched} games with ESPN IDs!`));
}

findESPNIds().catch(console.error);