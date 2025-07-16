#!/usr/bin/env tsx
/**
 * Test NCAA Football Games Fetcher (limited timeframe)
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

async function testGamesFetcher() {
  console.log(chalk.bold.blue('🧪 TESTING NCAA FOOTBALL GAMES FETCHER\n'));
  
  // Test 1: Fetch a single week of games to verify API works
  const testDate = '20240831'; // Week 1 of 2024 season
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${testDate}&groups=80&limit=500`;
  
  try {
    console.log('📡 Testing ESPN API call...');
    const response = await axios.get(url);
    
    if (response.data?.events) {
      console.log(`✅ API working: Found ${response.data.events.length} games for ${testDate}`);
      
      // Show sample game
      if (response.data.events.length > 0) {
        const game = response.data.events[0];
        const homeTeam = game.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = game.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
        
        console.log('\n📊 Sample game:');
        console.log(`   ${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`);
        console.log(`   Status: ${game.status.type.name}`);
        console.log(`   Score: ${awayTeam.score} - ${homeTeam.score}`);
        console.log(`   Date: ${game.date}`);
        console.log(`   Venue: ${game.competitions[0].venue?.fullName}`);
      }
    } else {
      console.log('❌ No events found in API response');
    }
  } catch (error: any) {
    console.error('❌ API Error:', error.message);
    return;
  }
  
  // Test 2: Check team mappings
  console.log('\n🏈 Testing team mappings...');
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, external_id, name, metadata')
    .eq('sport', 'NCAA_FB')
    .limit(5);
  
  if (teamError) {
    console.error('❌ Error fetching teams:', teamError);
    return;
  }
  
  console.log(`✅ Found ${teams?.length} teams in database`);
  teams?.forEach(team => {
    const espnId = (team.metadata as any)?.espn_id;
    console.log(`   ${team.name} -> ESPN ID: ${espnId}`);
  });
  
  console.log(chalk.green('\n🎉 Games fetcher test complete!'));
  console.log(chalk.yellow('Ready to run full games collection.'));
}

testGamesFetcher().catch(console.error);