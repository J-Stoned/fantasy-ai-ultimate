#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema\n');
  
  try {
    // First, let's just try to get one game record to see its structure
    const { data: sampleGame, error: gameError } = await supabase
      .from('games')
      .select('*')
      .limit(1)
      .single();
    
    if (gameError) {
      console.error('Error fetching game:', gameError);
    } else if (sampleGame) {
      console.log('📊 GAMES TABLE COLUMNS:');
      console.log(Object.keys(sampleGame).join(', '));
      console.log('\nSample game record:');
      console.log(JSON.stringify(sampleGame, null, 2));
    }
    
    // Check player_stats structure
    const { data: samplePlayerStat, error: statError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(1)
      .single();
    
    if (!statError && samplePlayerStat) {
      console.log('\n📈 PLAYER_STATS TABLE COLUMNS:');
      console.log(Object.keys(samplePlayerStat).join(', '));
    }
    
    // Check player_game_logs structure
    const { data: sampleGameLog, error: logError } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(1)
      .single();
    
    if (!logError && sampleGameLog) {
      console.log('\n🏀 PLAYER_GAME_LOGS TABLE COLUMNS:');
      console.log(Object.keys(sampleGameLog).join(', '));
    }
    
    // Check teams table
    const { data: sampleTeam, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .limit(1)
      .single();
    
    if (!teamError && sampleTeam) {
      console.log('\n🏆 TEAMS TABLE COLUMNS:');
      console.log(Object.keys(sampleTeam).join(', '));
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkDatabaseSchema();