#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const ballDontLieApiKey = '59de4292-dfc4-4a8a-b337-1e804f4109c6';
const ballDontLieApi = axios.create({
  baseURL: 'https://api.balldontlie.io/v1',
  headers: { 'Authorization': ballDontLieApiKey }
});

async function testNBAMegaBatch() {
  console.log('🏀 Testing NBA Mega Batch Processor\n');

  // Test 1: Check NBA games in database
  const { data: nbaGames, count } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id', { count: 'exact' })
    .eq('sport', 'NBA')
    .gte('start_time', '2023-10-01')
    .lte('start_time', '2024-06-30')
    .limit(5);

  console.log(`📊 Found ${count} NBA games for 2023-24 season`);
  console.log('Sample games:');
  nbaGames?.forEach(game => {
    console.log(`- Game ${game.id}: ${game.external_id} on ${game.start_time}`);
  });

  // Test 2: Try BallDontLie API
  console.log('\n🔌 Testing BallDontLie API...');
  try {
    // Get a recent game
    const gamesResponse = await ballDontLieApi.get('/games', {
      params: {
        start_date: '2024-01-01',
        end_date: '2024-01-02',
        per_page: 1
      }
    });

    if (gamesResponse.data.data.length > 0) {
      const game = gamesResponse.data.data[0];
      console.log(`✅ API working! Found game: ${game.home_team.full_name} vs ${game.visitor_team.full_name}`);
      
      // Try to get stats for this game
      const statsResponse = await ballDontLieApi.get('/stats', {
        params: {
          game_ids: [game.id],
          per_page: 5
        }
      });

      console.log(`📊 Found ${statsResponse.data.data.length} player stats for this game`);
      if (statsResponse.data.data.length > 0) {
        const stat = statsResponse.data.data[0];
        console.log(`Sample stat: ${stat.player.first_name} ${stat.player.last_name} - ${stat.pts} points`);
      }
    }
  } catch (error: any) {
    console.error('❌ BallDontLie API error:', error.response?.data || error.message);
  }

  // Test 3: Check if we can match game IDs
  console.log('\n🔗 Testing game ID matching...');
  if (nbaGames && nbaGames.length > 0) {
    const sampleExternalId = nbaGames[0].external_id;
    const ballDontLieId = parseInt(sampleExternalId.replace('nba_', ''));
    console.log(`Database external_id: ${sampleExternalId}`);
    console.log(`Extracted BallDontLie ID: ${ballDontLieId}`);
    
    // Note: The external_id format might be different
    console.log('\n⚠️  Note: Game ID mapping might need adjustment');
    console.log('Database uses format: nba_401267399');
    console.log('BallDontLie uses numeric IDs like: 473073');
  }

  console.log('\n✅ Test complete! Ready to run full mega batch processor.');
  console.log('\nTo run the full processor:');
  console.log('npx tsx scripts/nba-stats-megabatch-processor.ts');
}

testNBAMegaBatch().catch(console.error);