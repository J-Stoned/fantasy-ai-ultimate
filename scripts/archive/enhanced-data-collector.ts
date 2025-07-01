#!/usr/bin/env tsx
/**
 * ENHANCED DATA COLLECTOR - Multiple Sports with Working APIs
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.blue.bold('🚀 FANTASY AI ULTIMATE - ENHANCED DATA COLLECTOR'));
console.log(chalk.blue('================================================\n'));

// Collect ESPN news for multiple sports
async function collectMultiSportNews() {
  console.log(chalk.yellow('📰 Collecting multi-sport news...'));
  
  const sports = [
    { id: 'nfl', name: 'NFL', url: 'https://www.espn.com/espn/rss/nfl/news' },
    { id: 'nba', name: 'NBA', url: 'https://www.espn.com/espn/rss/nba/news' },
    { id: 'mlb', name: 'MLB', url: 'https://www.espn.com/espn/rss/mlb/news' },
    { id: 'nhl', name: 'NHL', url: 'https://www.espn.com/espn/rss/nhl/news' }
  ];
  
  let totalNews = 0;
  
  for (const sport of sports) {
    try {
      const response = await axios.get(sport.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const items = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
      
      for (const item of items.slice(0, 3)) { // Get top 3 per sport
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const description = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
        
        if (title && link) {
          const { error } = await supabase.from('news_articles').upsert({
            title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
            url: link,
            source: 'ESPN',
            sport_id: sport.id,
            summary: description.replace(/<!\[CDATA\[|\]\]>/g, '').substring(0, 200),
            published_at: new Date(pubDate).toISOString(),
            content: 'Click to read full article'
          }, {
            onConflict: 'url'
          });
          
          if (!error) totalNews++;
        }
      }
    } catch (error) {
      console.log(chalk.red(`  ❌ ${sport.name} news failed:`, error.message));
    }
  }
  
  console.log(chalk.green(`✅ Collected ${totalNews} news articles across all sports\n`));
}

// Collect NFL teams and rosters from ESPN
async function collectNFLData() {
  console.log(chalk.yellow('🏈 Collecting NFL teams and players...'));
  
  try {
    // Get NFL teams
    const teamsResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
    const teams = teamsResponse.data.sports[0].leagues[0].teams;
    
    let teamCount = 0;
    let playerCount = 0;
    
    for (const teamData of teams.slice(0, 5)) { // Get first 5 teams for demo
      const team = teamData.team;
      
      // Insert team
      const { data: insertedTeam, error: teamError } = await supabase
        .from('teams')
        .upsert({
          name: team.displayName,
          city: team.location,
          abbreviation: team.abbreviation,
          sport_id: 'nfl',
          league_id: 'NFL',
          logo_url: team.logos?.[0]?.href
        }, {
          onConflict: 'name,sport_id'
        })
        .select()
        .single();
      
      if (!teamError && insertedTeam) {
        teamCount++;
        
        // Try to get roster (this endpoint might need auth)
        try {
          const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/roster`;
          const rosterResponse = await axios.get(rosterUrl);
          
          if (rosterResponse.data.athletes) {
            for (const athlete of rosterResponse.data.athletes.slice(0, 5)) {
              const { error: playerError } = await supabase.from('players').upsert({
                firstName: athlete.firstName,
                lastName: athlete.lastName,
                position: [athlete.position?.abbreviation || 'N/A'],
                jersey_number: parseInt(athlete.jersey) || null,
                team_id: insertedTeam.id,
                sport_id: 'nfl',
                external_id: athlete.id?.toString(),
                photo_url: athlete.headshot?.href
              }, {
                onConflict: 'firstName,lastName,sport_id'
              });
              
              if (!playerError) playerCount++;
            }
          }
        } catch (rosterError) {
          // Roster endpoint might require auth, skip
        }
      }
    }
    
    console.log(chalk.green(`✅ Collected ${teamCount} NFL teams and ${playerCount} players\n`));
  } catch (error) {
    console.log(chalk.red('❌ NFL data collection failed:', error.message));
  }
}

// Collect live scores
async function collectLiveScores() {
  console.log(chalk.yellow('🏆 Collecting live scores...'));
  
  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const games = response.data.events || [];
    let gameCount = 0;
    
    for (const game of games) {
      const competition = game.competitions[0];
      const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
      const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
      
      // First, ensure teams exist
      const { data: homeTeamData } = await supabase
        .from('teams')
        .select('id')
        .eq('abbreviation', homeTeam.team.abbreviation)
        .eq('sport_id', 'nfl')
        .single();
        
      const { data: awayTeamData } = await supabase
        .from('teams')
        .select('id')
        .eq('abbreviation', awayTeam.team.abbreviation)
        .eq('sport_id', 'nfl')
        .single();
      
      if (homeTeamData && awayTeamData) {
        const { error } = await supabase.from('games').upsert({
          home_team_id: homeTeamData.id,
          away_team_id: awayTeamData.id,
          sport_id: 'nfl',
          start_time: new Date(game.date).toISOString(),
          venue: competition.venue?.fullName,
          home_score: parseInt(homeTeam.score) || 0,
          away_score: parseInt(awayTeam.score) || 0,
          status: competition.status.type.name,
          external_id: game.id
        }, {
          onConflict: 'external_id'
        });
        
        if (!error) gameCount++;
      }
    }
    
    console.log(chalk.green(`✅ Updated ${gameCount} game scores\n`));
  } catch (error) {
    console.log(chalk.red('❌ Score collection failed:', error.message));
  }
}

// Main function
async function startEnhancedCollection() {
  // Test connection
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error(chalk.red('❌ Database connection failed:', error.message));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Database connected!\n'));
  
  // Run initial collection
  console.log(chalk.blue('🏁 Running initial enhanced collection...\n'));
  await collectMultiSportNews();
  await collectNFLData();
  await collectLiveScores();
  
  // Schedule collections
  console.log(chalk.blue('📅 Scheduling enhanced collections...\n'));
  
  // Multi-sport news every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log(chalk.cyan(`\n⏰ [${new Date().toLocaleTimeString()}] Collecting news...`));
    await collectMultiSportNews();
  });
  
  // NFL data every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log(chalk.cyan(`\n⏰ [${new Date().toLocaleTimeString()}] Updating NFL data...`));
    await collectNFLData();
  });
  
  // Live scores every 5 minutes during game days
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date();
    const day = now.getDay();
    // Run on Thursday, Sunday, Monday (NFL game days)
    if (day === 0 || day === 1 || day === 4) {
      console.log(chalk.cyan(`\n⏰ [${new Date().toLocaleTimeString()}] Updating scores...`));
      await collectLiveScores();
    }
  });
  
  // Health check
  cron.schedule('* * * * *', () => {
    const uptime = Math.floor(process.uptime() / 60);
    const memory = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
    console.log(chalk.gray(`💚 Health - Uptime: ${uptime}m, Memory: ${memory}MB, Time: ${new Date().toLocaleTimeString()}`));
  });
  
  console.log(chalk.green.bold('✅ ENHANCED DATA COLLECTION ACTIVE!'));
  console.log(chalk.green('====================================='));
  console.log('📰 Multi-sport News: Every 10 minutes');
  console.log('🏈 NFL Teams/Players: Every 30 minutes');
  console.log('🏆 Live Scores: Every 5 minutes (game days)');
  console.log('💚 Health Check: Every minute');
  console.log(chalk.gray('\nPress Ctrl+C to stop\n'));
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down enhanced data collection...'));
  process.exit(0);
});

// Start collection
startEnhancedCollection().catch(console.error);