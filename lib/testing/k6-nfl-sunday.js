/**
 * MARCUS "THE FIXER" RODRIGUEZ - K6 NFL SUNDAY CHAOS TEST
 * 
 * This is the real deal. K6 for distributed load testing that simulates
 * the absolute mayhem of NFL Sunday across multiple regions.
 * 
 * Run locally: k6 run k6-nfl-sunday.js
 * Run on cloud: k6 cloud k6-nfl-sunday.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const loginTime = new Trend('login_time');
const scoreUpdateTime = new Trend('score_update_time');
const lineupChangeTime = new Trend('lineup_change_time');
const aiResponseTime = new Trend('ai_response_time');

// Test configuration
export const options = {
  // Simulate NFL Sunday traffic pattern
  stages: [
    // Pre-game buildup (9am - 12pm ET)
    { duration: '5m', target: 1000 },   // Ramp up to 1k users
    { duration: '10m', target: 5000 },  // Morning lineup tinkering
    
    // Early games kickoff (1pm ET)
    { duration: '2m', target: 20000 },  // Massive spike
    { duration: '15m', target: 15000 }, // Sustained high load
    
    // Halftime adjustments
    { duration: '5m', target: 25000 },  // Another spike
    { duration: '10m', target: 18000 }, // Sustained load
    
    // Late games kickoff (4:25pm ET)
    { duration: '2m', target: 30000 },  // Peak load
    { duration: '20m', target: 25000 }, // Sustained peak
    
    // Sunday Night Football
    { duration: '5m', target: 15000 },  // Drop off
    { duration: '10m', target: 10000 }, // Evening load
    
    // Wind down
    { duration: '5m', target: 0 },      // Ramp down
  ],
  
  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'], // 95% under 500ms
    http_req_failed: ['rate<0.01'],                  // Error rate under 1%
    errors: ['rate<0.01'],                           // Custom error rate
    score_update_time: ['p(95)<200'],                // Real-time updates
    lineup_change_time: ['p(95)<1000'],              // Lineup changes
    ai_response_time: ['p(95)<3000'],                // AI responses
  },
  
  // Multiple load zones for geographic distribution
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 40 },
        'amazon:us:portland': { loadZone: 'amazon:us:portland', percent: 30 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 20 },
        'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 10 },
      },
    },
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PLAYERS = generatePlayers(500);
const LEAGUES = generateLeagues(100);

// User behavior scenarios
export default function () {
  // Each VU (virtual user) represents a fantasy manager
  const userId = `user_${__VU}_${__ITER}`;
  const authToken = login(userId);
  
  if (!authToken) {
    errorRate.add(1);
    return;
  }
  
  // Weighted scenario selection (what users actually do on Sunday)
  const scenario = selectScenario();
  
  switch (scenario) {
    case 'obsessive_scorer':
      obsessiveScoreChecker(authToken);
      break;
    case 'lineup_tinkerer':
      lineupTinkerer(authToken);
      break;
    case 'trade_shark':
      tradeShark(authToken);
      break;
    case 'waiver_hunter':
      waiverHunter(authToken);
      break;
    case 'ai_questioner':
      aiQuestioner(authToken);
      break;
    case 'mobile_warrior':
      mobileWarrior(authToken);
      break;
    default:
      casualUser(authToken);
  }
  
  sleep(randomIntBetween(1, 5)); // Think time
}

// User scenarios
function obsessiveScoreChecker(token) {
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };
  
  // Check scores every 30 seconds like a maniac
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/games/live`, { headers });
    scoreUpdateTime.add(Date.now() - start);
    
    check(res, {
      'live scores loaded': (r) => r.status === 200,
      'scores updated recently': (r) => {
        const data = r.json();
        return data.lastUpdate && (Date.now() - new Date(data.lastUpdate).getTime()) < 60000;
      },
    });
    
    // Check specific player stats
    const playerIds = randomItem(LEAGUES).roster;
    const statsRes = http.get(
      `${BASE_URL}/api/players/stats/live?ids=${playerIds.join(',')}`,
      { headers }
    );
    
    check(statsRes, {
      'player stats loaded': (r) => r.status === 200,
    });
    
    sleep(randomIntBetween(20, 40));
  }
}

function lineupTinkerer(token) {
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  const leagueId = randomItem(LEAGUES).id;
  
  // Get current lineup
  const getRes = http.get(`${BASE_URL}/api/lineup/${leagueId}`, { headers });
  check(getRes, { 'lineup loaded': (r) => r.status === 200 });
  
  // Make 3-5 lineup changes (Sunday morning panic)
  const changes = randomIntBetween(3, 5);
  for (let i = 0; i < changes; i++) {
    const start = Date.now();
    const lineup = generateLineup();
    
    const putRes = http.put(
      `${BASE_URL}/api/lineup/${leagueId}`,
      JSON.stringify({ lineup }),
      { headers }
    );
    
    lineupChangeTime.add(Date.now() - start);
    
    check(putRes, {
      'lineup updated': (r) => r.status === 200,
      'lineup locked check': (r) => {
        if (r.status === 423) {
          console.log('Lineup locked - game started');
          return true;
        }
        return r.status === 200;
      },
    });
    
    sleep(randomIntBetween(30, 90)); // Think about next change
  }
}

function tradeShark(token) {
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // Analyze multiple trade scenarios
  for (let i = 0; i < 5; i++) {
    const give = randomItem(PLAYERS, 2);
    const receive = randomItem(PLAYERS, 2);
    
    const analysisRes = http.get(
      `${BASE_URL}/api/trades/analysis?give=${give.join(',')}&receive=${receive.join(',')}`,
      { headers }
    );
    
    check(analysisRes, {
      'trade analysis complete': (r) => r.status === 200,
      'trade has recommendation': (r) => r.json().recommendation !== undefined,
    });
    
    // 20% chance to actually propose the trade
    if (Math.random() < 0.2) {
      const tradeRes = http.post(
        `${BASE_URL}/api/trades`,
        JSON.stringify({
          leagueId: randomItem(LEAGUES).id,
          give,
          receive,
          targetTeamId: randomItem(LEAGUES).teams,
          message: 'Sunday special - accept before kickoff!',
        }),
        { headers }
      );
      
      check(tradeRes, {
        'trade proposed': (r) => r.status === 201,
      });
    }
    
    sleep(randomIntBetween(10, 30));
  }
}

function aiQuestioner(token) {
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  const questions = [
    'Should I start Mahomes or Allen?',
    'Is it going to rain in Buffalo?',
    'Who has the best matchup at RB this week?',
    'Should I drop Zach Moss?',
    'What do you think about this trade: CMC for Jefferson?',
    'Optimize my lineup for upside',
    'Who are the sleepers this week?',
    'Is Kelce washed?',
  ];
  
  // Ask 2-3 questions
  const numQuestions = randomIntBetween(2, 3);
  for (let i = 0; i < numQuestions; i++) {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/ai/assistant`,
      JSON.stringify({ 
        query: randomItem(questions),
        context: { leagueId: randomItem(LEAGUES).id },
      }),
      { headers }
    );
    
    aiResponseTime.add(Date.now() - start);
    
    check(res, {
      'AI responded': (r) => r.status === 200,
      'AI response not empty': (r) => r.json().response?.length > 0,
      'AI response time acceptable': (r) => (Date.now() - start) < 3000,
    });
    
    sleep(randomIntBetween(20, 60)); // Read response
  }
}

function mobileWarrior(token) {
  // Simulate mobile app behavior with different headers
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'FantasyAI/1.0 (iPhone; iOS 16.0)',
    'X-App-Version': '1.0.0',
  };
  
  // Quick score checks
  const res = http.get(`${BASE_URL}/api/games/live?summary=true`, { headers });
  check(res, { 'mobile scores loaded': (r) => r.status === 200 });
  
  // Push notification registration
  const pushRes = http.post(
    `${BASE_URL}/api/notifications/register`,
    JSON.stringify({ 
      token: `push_${__VU}_${__ITER}`,
      platform: 'ios',
    }),
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  );
  
  check(pushRes, { 'push registered': (r) => r.status === 200 });
}

function casualUser(token) {
  const headers = { 'Authorization': `Bearer ${token}` };
  
  // Just check scores and lineup once
  const res = http.get(`${BASE_URL}/api/dashboard`, { headers });
  check(res, { 'dashboard loaded': (r) => r.status === 200 });
  
  sleep(randomIntBetween(60, 120)); // Browse for a bit
}

// Helper functions
function login(userId) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ 
      username: userId,
      password: 'load_test_password',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  loginTime.add(Date.now() - start);
  
  if (res.status !== 200) {
    console.error(`Login failed for ${userId}: ${res.status}`);
    return null;
  }
  
  return res.json().token;
}

function selectScenario() {
  const rand = Math.random() * 100;
  if (rand < 35) return 'obsessive_scorer';
  if (rand < 55) return 'lineup_tinkerer';
  if (rand < 65) return 'trade_shark';
  if (rand < 75) return 'waiver_hunter';
  if (rand < 85) return 'ai_questioner';
  if (rand < 95) return 'mobile_warrior';
  return 'casual_user';
}

function generatePlayers(count) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];
  return Array.from({ length: count }, (_, i) => ({
    id: `player_${i}`,
    position: positions[i % positions.length],
  }));
}

function generateLeagues(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `league_${i}`,
    roster: Array.from({ length: 15 }, () => 
      `player_${randomIntBetween(0, 499)}`
    ),
    teams: Array.from({ length: 12 }, (_, j) => `team_${i}_${j}`),
  }));
}

function generateLineup() {
  return {
    QB: `player_${randomIntBetween(0, 99)}`,
    RB1: `player_${randomIntBetween(100, 199)}`,
    RB2: `player_${randomIntBetween(100, 199)}`,
    WR1: `player_${randomIntBetween(200, 299)}`,
    WR2: `player_${randomIntBetween(200, 299)}`,
    TE: `player_${randomIntBetween(300, 349)}`,
    FLEX: `player_${randomIntBetween(100, 299)}`,
    DST: `player_${randomIntBetween(400, 449)}`,
    K: `player_${randomIntBetween(450, 499)}`,
  };
}

/**
 * THE MARCUS GUARANTEE:
 * 
 * This k6 script simulates REAL NFL Sunday behavior:
 * - Geographic distribution across time zones
 * - Realistic user patterns (obsessive refreshers, lineup tinkerers, etc.)
 * - Mobile vs web traffic mix
 * - Peak load during game times
 * - Complex user journeys
 * 
 * Run locally:
 * k6 run k6-nfl-sunday.js
 * 
 * Run distributed (requires k6 cloud):
 * k6 cloud k6-nfl-sunday.js
 * 
 * Monitor results:
 * k6 run --out influxdb=http://localhost:8086/k6 k6-nfl-sunday.js
 * 
 * - Marcus "The Fixer" Rodriguez
 */