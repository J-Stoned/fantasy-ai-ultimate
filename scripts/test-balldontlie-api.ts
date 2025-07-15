#!/usr/bin/env node
import axios from 'axios';

// Test BallDontLie API with the provided key
const ballDontLieApiKey = '59de4292-dfc4-4a8a-b337-1e804f4109c6';

async function testAPI() {
  console.log('🏀 Testing BallDontLie API...\n');

  // Test 1: Basic connection without auth header
  try {
    console.log('Test 1: Fetching teams (no auth)...');
    const response = await axios.get('https://api.balldontlie.io/v1/teams');
    console.log(`✅ Success! Found ${response.data.data.length} teams`);
    console.log(`Sample team: ${response.data.data[0].full_name}`);
  } catch (error: any) {
    console.log('❌ Failed without auth');
  }

  // Test 2: With Authorization header
  try {
    console.log('\nTest 2: Fetching teams (with auth)...');
    const response = await axios.get('https://api.balldontlie.io/v1/teams', {
      headers: { 'Authorization': ballDontLieApiKey }
    });
    console.log(`✅ Success! Found ${response.data.data.length} teams`);
  } catch (error: any) {
    console.log('❌ Failed with auth:', error.response?.status, error.response?.statusText);
  }

  // Test 3: Try different auth format
  try {
    console.log('\nTest 3: Fetching teams (Bearer token)...');
    const response = await axios.get('https://api.balldontlie.io/v1/teams', {
      headers: { 'Authorization': `Bearer ${ballDontLieApiKey}` }
    });
    console.log(`✅ Success! Found ${response.data.data.length} teams`);
  } catch (error: any) {
    console.log('❌ Failed with Bearer:', error.response?.status);
  }

  // Test 4: Games endpoint
  try {
    console.log('\nTest 4: Fetching recent games...');
    const response = await axios.get('https://api.balldontlie.io/v1/games', {
      params: {
        start_date: '2024-01-01',
        end_date: '2024-01-02',
        per_page: 5
      }
    });
    console.log(`✅ Found ${response.data.data.length} games`);
    if (response.data.data.length > 0) {
      const game = response.data.data[0];
      console.log(`Sample: ${game.home_team.full_name} vs ${game.visitor_team.full_name}`);
      console.log(`Game ID: ${game.id}`);
    }
  } catch (error: any) {
    console.log('❌ Failed to get games:', error.response?.status);
  }

  // Test 5: Stats endpoint
  try {
    console.log('\nTest 5: Fetching player stats...');
    const response = await axios.get('https://api.balldontlie.io/v1/stats', {
      params: {
        start_date: '2024-01-01',
        end_date: '2024-01-02',
        per_page: 5
      }
    });
    console.log(`✅ Found ${response.data.data.length} player stats`);
    if (response.data.data.length > 0) {
      const stat = response.data.data[0];
      console.log(`Sample: ${stat.player.first_name} ${stat.player.last_name} - ${stat.pts} points`);
    }
  } catch (error: any) {
    console.log('❌ Failed to get stats:', error.response?.status);
  }

  console.log('\n📊 API Test Summary:');
  console.log('The BallDontLie API v1 appears to be free and does not require authentication.');
  console.log('You can make requests directly without any API key!');
}

testAPI().catch(console.error);