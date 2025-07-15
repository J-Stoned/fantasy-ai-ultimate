#!/usr/bin/env tsx
/**
 * 🧪 TEST PATTERN SETUP
 * 
 * Creates test patterns in the database for betting integration testing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupTestPatterns() {
  console.log('🧪 Setting up test patterns for betting integration...\n');
  
  // First, let's get some team IDs or create test teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .in('abbreviation', ['BOS', 'NYY', 'LAD', 'COL', 'HOU', 'SEA'])
    .limit(6);
  
  let teamMap: any = {};
  if (teams && teams.length > 0) {
    teams.forEach(team => {
      teamMap[team.abbreviation] = team.id;
    });
  } else {
    // Create test teams if they don't exist
    const testTeams = [
      { name: 'Boston Red Sox', abbreviation: 'BOS', sport: 'MLB' },
      { name: 'New York Yankees', abbreviation: 'NYY', sport: 'MLB' },
      { name: 'Los Angeles Dodgers', abbreviation: 'LAD', sport: 'MLB' },
      { name: 'Colorado Rockies', abbreviation: 'COL', sport: 'MLB' },
      { name: 'Houston Astros', abbreviation: 'HOU', sport: 'MLB' },
      { name: 'Seattle Mariners', abbreviation: 'SEA', sport: 'MLB' }
    ];
    
    const { data: createdTeams } = await supabase
      .from('teams')
      .insert(testTeams)
      .select();
    
    if (createdTeams) {
      createdTeams.forEach(team => {
        teamMap[team.abbreviation] = team.id;
      });
    }
  }
  
  // Create test games with patterns
  const testGames = [
    {
      external_id: 'test_yankees_redsox',
      sport: 'MLB',
      home_team_id: teamMap['BOS'] || 1,
      away_team_id: teamMap['NYY'] || 2,
      start_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      venue: 'Fenway Park',
      status: 'scheduled',
      metadata: {
        has_pattern: true,
        pattern_types: ['back_to_back_fade'],
        pattern_confidence: 0.768,
        is_home_back_to_back: true,
        home_team: 'Boston Red Sox',
        away_team: 'New York Yankees'
      }
    },
    {
      external_id: 'test_dodgers_rockies',
      sport: 'MLB',
      home_team_id: teamMap['COL'] || 3,
      away_team_id: teamMap['LAD'] || 4,
      start_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      venue: 'Coors Field',
      status: 'scheduled',
      metadata: {
        has_pattern: true,
        pattern_types: ['altitude_advantage'],
        pattern_confidence: 0.683,
        home_team: 'Colorado Rockies',
        away_team: 'Los Angeles Dodgers'
      }
    },
    {
      external_id: 'test_astros_mariners',
      sport: 'MLB',
      home_team_id: teamMap['SEA'] || 5,
      away_team_id: teamMap['HOU'] || 6,
      start_time: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
      venue: 'T-Mobile Park',
      status: 'scheduled',
      metadata: {
        has_pattern: true,
        pattern_types: ['embarrassment_revenge'],
        pattern_confidence: 0.744,
        is_home_team: false,
        home_team: 'Seattle Mariners',
        away_team: 'Houston Astros'
      }
    }
  ];
  
  // Insert test games
  const { data, error } = await supabase
    .from('games')
    .upsert(testGames, { onConflict: 'external_id' })
    .select();
  
  if (error) {
    console.error('❌ Error inserting test games:', error);
    return;
  }
  
  console.log(`✅ Created ${data.length} test games with patterns`);
  data.forEach(game => {
    const metadata = game.metadata as any;
    console.log(`   - ${metadata?.away_team} @ ${metadata?.home_team}`);
    console.log(`     Pattern: ${metadata?.pattern_types?.[0]} (${(metadata?.pattern_confidence * 100).toFixed(1)}% confidence)`);
  });
  
  console.log('\n🎯 Test patterns ready for betting integration!');
  console.log('Run the DraftKings or FanDuel scripts to see pattern-based opportunities.\n');
}

async function cleanupTestPatterns() {
  console.log('🧹 Cleaning up test patterns...');
  
  const { error } = await supabase
    .from('games')
    .delete()
    .like('game_id', 'test_%');
  
  if (error) {
    console.error('❌ Error cleaning up:', error);
  } else {
    console.log('✅ Test patterns cleaned up');
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'cleanup') {
    await cleanupTestPatterns();
  } else {
    await setupTestPatterns();
  }
}

if (require.main === module) {
  main();
}

export { setupTestPatterns, cleanupTestPatterns };