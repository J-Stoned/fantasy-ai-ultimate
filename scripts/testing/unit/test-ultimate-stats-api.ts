import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000/api/v3/ultimate-stats';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🧪 TESTING ULTIMATE STATS API V3 ENDPOINTS');
console.log('=========================================\n');

// Test results tracking
const testResults: any[] = [];

async function testEndpoint(
  name: string,
  method: string,
  url: string,
  body?: any,
  expectedStatus = 200
) {
  const startTime = Date.now();
  
  try {
    console.log(`\n📍 Testing: ${name}`);
    console.log(`   Method: ${method} ${url}`);
    
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
      console.log(`   Body: ${JSON.stringify(body)}`);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    const passed = response.status === expectedStatus;
    
    console.log(`   Status: ${response.status} ${passed ? '✅' : '❌'}`);
    console.log(`   Response Time: ${duration}ms`);
    
    if (passed && data) {
      // Log key response data
      if (data.data) {
        console.log(`   Records: ${Array.isArray(data.data) ? data.data.length : 1}`);
      }
      if (data.meta) {
        console.log(`   Meta: ${JSON.stringify(data.meta).substring(0, 100)}...`);
      }
    } else if (!passed) {
      console.log(`   Error: ${JSON.stringify(data.error || data)}`);
    }
    
    testResults.push({
      name,
      method,
      url,
      passed,
      status: response.status,
      duration,
      error: passed ? null : data.error
    });
    
    return { passed, data };
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    testResults.push({
      name,
      method,
      url,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    });
    return { passed: false, error };
  }
}

async function runTests() {
  // Get test data for realistic IDs
  console.log('📊 Getting test data from database...');
  
  const { data: samplePlayer } = await supabase
    .from('players')
    .select('id, name, sport')
    .not('id', 'is', null)
    .limit(1)
    .single();
    
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, sport, home_team, away_team')
    .eq('status', 'completed')
    .not('id', 'is', null)
    .limit(1)
    .single();
    
  const { data: sampleLiveGame } = await supabase
    .from('games')
    .select('id, sport')
    .eq('status', 'in_progress')
    .limit(1)
    .single();
  
  console.log(`\nTest Player: ${samplePlayer?.name || 'None found'}`);
  console.log(`Test Game: ${sampleGame?.id || 'None found'}`);
  console.log(`Live Game: ${sampleLiveGame?.id || 'None found'}\n`);
  
  // Test Suite 1: Main Ultimate Stats Endpoint
  console.log('\n=== TESTING MAIN ULTIMATE STATS ENDPOINT ===');
  
  await testEndpoint(
    'Get all ultimate stats',
    'GET',
    `${BASE_URL}`
  );
  
  await testEndpoint(
    'Get NBA ultimate stats',
    'GET',
    `${BASE_URL}?sport=NBA&limit=10`
  );
  
  await testEndpoint(
    'Get with pagination',
    'GET',
    `${BASE_URL}?limit=5&offset=10`
  );
  
  await testEndpoint(
    'Filter by team',
    'GET',
    `${BASE_URL}?team=${sampleGame?.home_team || 'LAL'}&limit=5`
  );
  
  await testEndpoint(
    'Filter by date range',
    'GET',
    `${BASE_URL}?date_from=2024-01-01&date_to=2024-12-31&limit=5`
  );
  
  await testEndpoint(
    'Get specific metrics only',
    'GET',
    `${BASE_URL}?metrics=true_shooting_pct,usage_rate,game_score&limit=5`
  );
  
  await testEndpoint(
    'Get live games only',
    'GET',
    `${BASE_URL}?live=true&limit=5`
  );
  
  if (samplePlayer) {
    await testEndpoint(
      'Filter by player',
      'GET',
      `${BASE_URL}?player_id=${samplePlayer.id}&limit=5`
    );
  }
  
  if (sampleGame) {
    await testEndpoint(
      'Filter by game',
      'GET',
      `${BASE_URL}?game_id=${sampleGame.id}`
    );
  }
  
  // Test POST endpoint
  await testEndpoint(
    'Calculate stats on-demand (missing params)',
    'POST',
    `${BASE_URL}`,
    {},
    400
  );
  
  if (sampleGame) {
    await testEndpoint(
      'Calculate stats for game',
      'POST',
      `${BASE_URL}`,
      { game_id: sampleGame.id }
    );
  }
  
  // Test Suite 2: Player-specific Endpoint
  console.log('\n=== TESTING PLAYER ENDPOINT ===');
  
  if (samplePlayer) {
    await testEndpoint(
      'Get player ultimate stats',
      'GET',
      `${BASE_URL}/players/${samplePlayer.id}`
    );
    
    await testEndpoint(
      'Get player last 5 games',
      'GET',
      `${BASE_URL}/players/${samplePlayer.id}?last_n_games=5`
    );
    
    await testEndpoint(
      'Get player season stats',
      'GET',
      `${BASE_URL}/players/${samplePlayer.id}?season=2024`
    );
    
    await testEndpoint(
      'Get player home games only',
      'GET',
      `${BASE_URL}/players/${samplePlayer.id}?home_away=home`
    );
    
    await testEndpoint(
      'Get player vs specific team',
      'GET',
      `${BASE_URL}/players/${samplePlayer.id}?vs_team=${sampleGame?.away_team || 'BOS'}`
    );
  }
  
  await testEndpoint(
    'Get invalid player',
    'GET',
    `${BASE_URL}/players/invalid-id`,
    undefined,
    404
  );
  
  // Test Suite 3: Game-specific Endpoint
  console.log('\n=== TESTING GAME ENDPOINT ===');
  
  if (sampleGame) {
    await testEndpoint(
      'Get game ultimate stats',
      'GET',
      `${BASE_URL}/games/${sampleGame.id}`
    );
    
    await testEndpoint(
      'Get home team stats only',
      'GET',
      `${BASE_URL}/games/${sampleGame.id}?team=home`
    );
    
    await testEndpoint(
      'Get away team stats only',
      'GET',
      `${BASE_URL}/games/${sampleGame.id}?team=away`
    );
    
    await testEndpoint(
      'Filter by min minutes',
      'GET',
      `${BASE_URL}/games/${sampleGame.id}?min_minutes=20`
    );
    
    await testEndpoint(
      'Refresh game stats',
      'POST',
      `${BASE_URL}/games/${sampleGame.id}/refresh`
    );
  }
  
  await testEndpoint(
    'Get invalid game',
    'GET',
    `${BASE_URL}/games/invalid-id`,
    undefined,
    404
  );
  
  // Test Suite 4: Edge Cases
  console.log('\n=== TESTING EDGE CASES ===');
  
  await testEndpoint(
    'Invalid sport filter',
    'GET',
    `${BASE_URL}?sport=INVALID`
  );
  
  await testEndpoint(
    'Excessive limit',
    'GET',
    `${BASE_URL}?limit=5000`
  );
  
  await testEndpoint(
    'Multiple filters combined',
    'GET',
    `${BASE_URL}?sport=NBA&limit=3&offset=0&metrics=fantasy_points_estimate`
  );
  
  // Summary
  console.log('\n\n========================================');
  console.log('📊 TEST SUMMARY');
  console.log('========================================\n');
  
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  const avgDuration = testResults.reduce((sum, t) => sum + (t.duration || 0), 0) / testResults.length;
  
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Avg Response Time: ${Math.round(avgDuration)}ms`);
  console.log(`Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%`);
  
  // Failed test details
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`\n   ${t.name}`);
        console.log(`   ${t.method} ${t.url}`);
        console.log(`   Error: ${t.error}`);
      });
  }
  
  // Performance insights
  console.log('\n⚡ PERFORMANCE INSIGHTS:');
  const slowTests = testResults
    .filter(t => t.duration > 500)
    .sort((a, b) => b.duration - a.duration);
    
  if (slowTests.length > 0) {
    console.log('\nSlowest endpoints:');
    slowTests.slice(0, 5).forEach(t => {
      console.log(`   ${t.name}: ${t.duration}ms`);
    });
  } else {
    console.log('   All endpoints responded in <500ms! 🚀');
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (failed === 0) {
    console.log('   ✅ All endpoints are working correctly!');
  } else {
    console.log('   ⚠️  Some endpoints need attention');
  }
  
  if (avgDuration > 200) {
    console.log('   ⚠️  Consider optimizing slow endpoints');
  } else {
    console.log('   ✅ Response times are excellent');
  }
  
  // Test caching behavior
  console.log('\n🔄 TESTING CACHE BEHAVIOR...');
  if (samplePlayer) {
    const url = `${BASE_URL}/players/${samplePlayer.id}?last_n_games=5`;
    
    // First request (cache miss)
    const result1 = await testEndpoint(
      'Cache test - first request',
      'GET',
      url
    );
    
    // Second request (should be cached)
    const result2 = await testEndpoint(
      'Cache test - second request (should be faster)',
      'GET',
      url
    );
    
    if (result1.passed && result2.passed) {
      const speedup = testResults[testResults.length - 2].duration - testResults[testResults.length - 1].duration;
      console.log(`   Cache speedup: ${speedup}ms faster on second request`);
    }
  }
  
  console.log('\n✅ API testing complete!');
  
  return {
    passed,
    failed,
    total: testResults.length,
    avgDuration: Math.round(avgDuration)
  };
}

// Run tests
runTests().catch(console.error);