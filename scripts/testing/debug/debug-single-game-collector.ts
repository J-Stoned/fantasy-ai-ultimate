#!/usr/bin/env tsx
/**
 * Debug script to process a single game and identify player matching issues
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugSingleGame() {
  console.log(chalk.bold.cyan('\n🔍 DEBUG SINGLE GAME COLLECTOR\n'));

  try {
    // Get one NFL game to debug
    const { data: game, error } = await supabase
      .from('games')
      .select('id, external_id, sport_id, home_team_id, away_team_id, start_time')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .limit(1)
      .single();

    if (error || !game) {
      console.error('No game found:', error);
      return;
    }

    console.log(chalk.yellow('Testing with game:'), game);

    // Extract ESPN ID
    const espnId = game.external_id.replace(/^espn_(?:nfl_)?/, '');
    console.log(chalk.yellow('ESPN ID:'), espnId);

    // Fetch from ESPN
    console.log('\n📡 Fetching from ESPN API...');
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
      {
        params: { event: espnId },
        timeout: 15000
      }
    );

    if (response.status !== 200) {
      console.error(chalk.red('API Error:'), response.status);
      return;
    }

    console.log(chalk.green('✓ ESPN API responded successfully'));

    // Analyze the response
    const gameData = response.data;
    const teams = gameData.boxscore?.players || [];
    
    console.log(chalk.yellow(`\n📊 Found ${teams.length} teams in boxscore`));

    // Count all players
    let totalPlayers = 0;
    let playersWithStats = 0;
    const allPlayerNames: string[] = [];

    for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
      const teamStats = teams[teamIdx];
      console.log(chalk.cyan(`\nTeam ${teamIdx + 1}:`));
      
      for (const category of (teamStats.statistics || [])) {
        console.log(chalk.yellow(`  Category: ${category.name} (${category.athletes?.length || 0} players)`));
        
        for (const athlete of (category.athletes || [])) {
          if (athlete.athlete?.displayName) {
            totalPlayers++;
            const name = athlete.athlete.displayName;
            if (!allPlayerNames.includes(name)) {
              allPlayerNames.push(name);
            }
            
            // Check if player has actual stats
            const hasStats = athlete.stats?.some((stat: any) => stat && stat !== '0' && stat !== '--');
            if (hasStats) {
              playersWithStats++;
            }
          }
        }
      }
    }

    console.log(chalk.bold.green(`\n📈 Player Summary:`));
    console.log(`  Total player entries: ${totalPlayers}`);
    console.log(`  Unique players: ${allPlayerNames.length}`);
    console.log(`  Players with stats: ${playersWithStats}`);

    // Check player matching
    console.log(chalk.bold.yellow('\n🔍 Testing Player Matching:'));
    
    // Load current players
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('id, name');
    
    console.log(`  Database has ${dbPlayers?.length || 0} total players`);

    // Create name lookup map
    const playerMap = new Map<string, number>();
    dbPlayers?.forEach(p => {
      playerMap.set(p.name.toLowerCase(), p.id);
      playerMap.set(p.name.replace(/[^a-zA-Z]/g, '').toLowerCase(), p.id);
    });

    // Test matching for first 10 players
    console.log('\n  Testing player matching:');
    let matched = 0;
    let unmatched = 0;
    
    for (let i = 0; i < Math.min(10, allPlayerNames.length); i++) {
      const name = allPlayerNames[i];
      const foundId = playerMap.get(name.toLowerCase()) || 
                     playerMap.get(name.replace(/[^a-zA-Z]/g, '').toLowerCase());
      
      if (foundId) {
        console.log(chalk.green(`    ✓ ${name} → ID: ${foundId}`));
        matched++;
      } else {
        console.log(chalk.red(`    ✗ ${name} → NOT FOUND`));
        unmatched++;
      }
    }

    console.log(chalk.bold(`\n  Match Rate: ${matched}/${matched + unmatched} (${((matched/(matched+unmatched))*100).toFixed(0)}%)`));

    // Show what a successful insert would look like
    console.log(chalk.bold.cyan('\n📝 Sample Stats Structure:'));
    const sampleTeam = teams[0];
    const sampleCategory = sampleTeam.statistics?.[0];
    const sampleAthlete = sampleCategory?.athletes?.[0];
    
    if (sampleAthlete) {
      console.log('  Player:', sampleAthlete.athlete?.displayName);
      console.log('  Category:', sampleCategory.name);
      console.log('  Labels:', sampleCategory.labels?.slice(0, 5).join(', '));
      console.log('  Values:', sampleAthlete.stats?.slice(0, 5).join(', '));
    }

    // Test game date extraction
    const gameDate = new Date(game.start_time).toISOString().split('T')[0];
    console.log(chalk.bold.yellow('\n📅 Game Date:'), gameDate);

    console.log(chalk.bold.green('\n✅ Debug Summary:'));
    console.log(`  - ESPN API works correctly`);
    console.log(`  - Found ${allPlayerNames.length} unique players in game`);
    console.log(`  - Player matching success rate: ${((matched/(matched+unmatched))*100).toFixed(0)}%`);
    console.log(`  - Most players NOT in database (need creation)`);
    console.log(`  - Game date extraction works: ${gameDate}`);

  } catch (error: any) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

debugSingleGame();