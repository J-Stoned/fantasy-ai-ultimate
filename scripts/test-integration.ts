/**
 * 🔥 INTEGRATION TEST FOR 21.5K GAMES 🔥
 * Tests all services with real database data
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Service endpoints
const PATTERN_GATEWAY = 'http://localhost:3000';
const PREDICTION_SERVICE = 'http://localhost:3339';
const WEBSOCKET_SERVER = 'http://localhost:3338';

async function testIntegration() {
  console.log('🔥 FANTASY AI INTEGRATION TEST 🔥\n');
  
  let passedTests = 0;
  let failedTests = 0;
  
  // Test 1: Database Connection
  console.log('📊 Test 1: Database Connection');
  try {
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Connected to database - Found ${gameCount} games`);
    
    if (gameCount && gameCount >= 20000) {
      console.log(`✅ Confirmed 20K+ games present (${gameCount} total)`);
      passedTests++;
    } else {
      console.log(`❌ Expected 20K+ games, found ${gameCount}`);
      failedTests++;
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    failedTests++;
  }
  
  // Test 2: Pattern Gateway
  console.log('\n📊 Test 2: Pattern Gateway API');
  try {
    const response = await axios.get(`${PATTERN_GATEWAY}/api/patterns/all`);
    const data = response.data;
    
    if (data.patterns && Array.isArray(data.patterns)) {
      console.log(`✅ Pattern Gateway working - ${data.patterns.length} patterns loaded`);
      
      if (data.stats) {
        console.log(`   Average Accuracy: ${data.stats.averageAccuracy}%`);
        console.log(`   Total Profit: $${data.stats.totalProfit}`);
      }
      passedTests++;
    } else {
      console.log('❌ Pattern Gateway returned invalid data');
      failedTests++;
    }
  } catch (error) {
    console.error('❌ Pattern Gateway not accessible:', error.message);
    console.log('   Make sure to run: npx tsx scripts/api-gateway/pattern-gateway.ts');
    failedTests++;
  }
  
  // Test 3: Pattern Opportunities
  console.log('\n📊 Test 3: Pattern Opportunities');
  try {
    const response = await axios.get(`${PATTERN_GATEWAY}/api/patterns/opportunities?minConfidence=0.65`);
    const data = response.data;
    
    if (data.opportunities) {
      console.log(`✅ Found ${data.opportunities.length} high-value opportunities`);
      
      if (data.opportunities.length > 0) {
        const sample = data.opportunities[0];
        console.log(`   Sample: ${sample.playerName} - ${sample.confidence}% confidence`);
      }
      passedTests++;
    } else {
      console.log('❌ No opportunities endpoint response');
      failedTests++;
    }
  } catch (error) {
    console.error('❌ Opportunities endpoint failed:', error.message);
    failedTests++;
  }
  
  // Test 4: Game Analysis
  console.log('\n📊 Test 4: Game Pattern Analysis');
  try {
    // Get a sample game
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id')
      .eq('sport', 'NFL')
      .limit(1)
      .single();
    
    if (games) {
      const response = await axios.post(`${PATTERN_GATEWAY}/api/patterns/analyze`, {
        gameId: games.id,
        sport: games.sport
      });
      
      const analysis = response.data;
      console.log(`✅ Game analysis working - ${analysis.patterns?.length || 0} patterns found`);
      console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
      console.log(`   Recommendation: ${analysis.recommendedBet}`);
      passedTests++;
    }
  } catch (error) {
    console.error('❌ Game analysis failed:', error.message);
    failedTests++;
  }
  
  // Test 5: Enhanced Prediction Service
  console.log('\n📊 Test 5: Enhanced Prediction Service');
  try {
    // Get a sample player
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('sport', 'NFL')
      .limit(1)
      .single();
    
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NFL')
      .limit(1)
      .single();
    
    if (player && game) {
      const response = await axios.post(`${PREDICTION_SERVICE}/api/predict`, {
        playerId: player.id,
        gameId: game.id,
        sport: 'NFL',
        includePatterns: true
      });
      
      const prediction = response.data;
      console.log(`✅ Prediction service working`);
      console.log(`   Player: ${prediction.playerName}`);
      console.log(`   Prediction: ${prediction.finalPrediction} points`);
      console.log(`   Pattern Boost: ${(prediction.patternBoost * 100).toFixed(1)}%`);
      console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      passedTests++;
    }
  } catch (error) {
    console.error('❌ Prediction service not accessible:', error.message);
    console.log('   Make sure to run: npx tsx scripts/production-services/enhanced-prediction-service.ts');
    failedTests++;
  }
  
  // Test 6: WebSocket Health
  console.log('\n📊 Test 6: WebSocket Server Health');
  try {
    const response = await axios.get(`${WEBSOCKET_SERVER}/health`);
    const health = response.data;
    
    console.log(`✅ WebSocket server healthy`);
    console.log(`   Connected clients: ${health.connected_clients}`);
    passedTests++;
  } catch (error) {
    console.error('❌ WebSocket server not accessible:', error.message);
    console.log('   Make sure to run: npx tsx scripts/websocket/pattern-websocket-server.ts');
    failedTests++;
  }
  
  // Test 7: Database Tables
  console.log('\n📊 Test 7: Required Database Tables');
  const requiredTables = [
    'pattern_performance',
    'pattern_multipliers',
    'fantasy_betting_insights',
    'ml_predictions',
    'pattern_analysis_history',
    'user_pattern_preferences'
  ];
  
  for (const table of requiredTables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      console.log(`✅ Table '${table}' exists (${count || 0} records)`);
      passedTests++;
    } catch (error) {
      console.error(`❌ Table '${table}' not accessible`);
      failedTests++;
    }
  }
  
  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('🏁 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${passedTests + failedTests}`);
  console.log(`🎯 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System ready for 21.5K games!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    console.log('\n📌 To start all services:');
    console.log('   1. npx tsx scripts/api-gateway/pattern-gateway.ts');
    console.log('   2. npx tsx scripts/production-services/enhanced-prediction-service.ts');
    console.log('   3. npx tsx scripts/websocket/pattern-websocket-server.ts');
  }
}

// Run the tests
testIntegration().catch(console.error);