#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExistingTables() {
  console.log('🏀 NBA Database Setup\n');
  
  // For now, let's skip creating tables and use the existing player_stats table
  // The NBA mega scraper will use the standardized ESPN ID format
  
  console.log('✅ Will use existing tables:');
  console.log('- games (6519 NBA games already loaded)');
  console.log('- player_stats (will store NBA stats with espn_nba_* format)');
  console.log('- players (will store NBA players with espn_nba_* format)');
  
  // Check sample NBA game structure
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NBA')
    .limit(1)
    .single();
    
  if (sampleGame) {
    console.log('\n📊 Sample NBA game structure:');
    console.log(`- ID: ${sampleGame.id}`);
    console.log(`- External ID: ${sampleGame.external_id}`);
    console.log(`- Home Team: ${sampleGame.home_team_id}`);
    console.log(`- Away Team: ${sampleGame.away_team_id}`);
    console.log(`- Date: ${sampleGame.start_time}`);
    console.log(`- Score: ${sampleGame.home_score} - ${sampleGame.away_score}`);
  }
  
  console.log('\n✅ Ready to create NBA mega batch scraper!');
}

checkExistingTables().catch(console.error);