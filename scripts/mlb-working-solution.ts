#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function workingSolution() {
  console.log('🎯 MLB STATS - WORKING SOLUTION\n');
  
  console.log('The Issue:');
  console.log('- player_stats table requires integer player_id');
  console.log('- Foreign key constraint requires player exists in players table');
  console.log('- MLB uses string IDs like "mlb_624424"');
  
  console.log('\n✅ BEST SOLUTION: Create MLB-specific tables\n');
  
  // This is the SQL to create a proper MLB stats structure
  const createTableSQL = `
-- 1. Create MLB players table
CREATE TABLE IF NOT EXISTS mlb_players (
  id SERIAL PRIMARY KEY,
  mlb_player_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255),
  position VARCHAR(50),
  team VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create MLB stats table
CREATE TABLE IF NOT EXISTS mlb_stats (
  id SERIAL PRIMARY KEY,
  mlb_player_id VARCHAR(50) REFERENCES mlb_players(mlb_player_id),
  game_id INTEGER REFERENCES games(id),
  stat_type VARCHAR(50),
  stat_value NUMERIC,
  fantasy_points NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for performance
CREATE INDEX idx_mlb_stats_player ON mlb_stats(mlb_player_id);
CREATE INDEX idx_mlb_stats_game ON mlb_stats(game_id);
CREATE INDEX idx_mlb_stats_type ON mlb_stats(stat_type);
`;

  console.log('Proposed table structure:');
  console.log(createTableSQL);
  
  console.log('\n📊 This solution provides:');
  console.log('- Proper MLB player identification');
  console.log('- No foreign key conflicts');
  console.log('- Easy querying by MLB ID');
  console.log('- Full stats storage capability');
  
  // Alternative: Work with existing structure
  console.log('\n\n🔧 ALTERNATIVE: Work with existing data\n');
  
  // Show what we can do with games data
  const { data: teamStats } = await supabase
    .from('games')
    .select('home_team_id, away_team_id, home_score, away_score')
    .eq('sport', 'MLB')
    .limit(10);
    
  if (teamStats && teamStats.length > 0) {
    console.log('Example analyses available:');
    
    // Calculate some stats
    const totalGames = teamStats.length;
    const totalRuns = teamStats.reduce((sum, game) => 
      sum + (game.home_score || 0) + (game.away_score || 0), 0);
    const avgRunsPerGame = totalRuns / totalGames / 2;
    
    console.log(`- Average runs per team per game: ${avgRunsPerGame.toFixed(2)}`);
    
    const highScoring = teamStats.filter(g => 
      (g.home_score || 0) + (g.away_score || 0) > 10).length;
    console.log(`- High-scoring games (>10 total): ${highScoring}/${totalGames}`);
    
    const blowouts = teamStats.filter(g => 
      Math.abs((g.home_score || 0) - (g.away_score || 0)) > 5).length;
    console.log(`- Blowout games (>5 run diff): ${blowouts}/${totalGames}`);
  }
  
  console.log('\n💡 RECOMMENDATION:');
  console.log('1. For player stats: Create new MLB-specific tables');
  console.log('2. For team analysis: Use existing games data');
  console.log('3. For betting patterns: Focus on game outcomes');
  
  // Create a view for easy team analysis
  console.log('\n📈 Useful view for team analysis:');
  const viewSQL = `
CREATE OR REPLACE VIEW mlb_team_performance AS
SELECT 
  t.name as team_name,
  t.id as team_id,
  COUNT(CASE WHEN g.home_team_id = t.id THEN 1 END) as home_games,
  COUNT(CASE WHEN g.away_team_id = t.id THEN 1 END) as away_games,
  COUNT(CASE WHEN g.home_team_id = t.id AND g.home_score > g.away_score THEN 1
             WHEN g.away_team_id = t.id AND g.away_score > g.home_score THEN 1 END) as wins,
  COUNT(CASE WHEN g.home_team_id = t.id AND g.home_score < g.away_score THEN 1
             WHEN g.away_team_id = t.id AND g.away_score < g.home_score THEN 1 END) as losses,
  AVG(CASE WHEN g.home_team_id = t.id THEN g.home_score
           WHEN g.away_team_id = t.id THEN g.away_score END) as avg_runs_scored,
  AVG(CASE WHEN g.home_team_id = t.id THEN g.away_score
           WHEN g.away_team_id = t.id THEN g.home_score END) as avg_runs_allowed
FROM teams t
LEFT JOIN games g ON (g.home_team_id = t.id OR g.away_team_id = t.id) 
  AND g.sport = 'MLB' 
  AND g.status = 'final'
WHERE t.sport = 'MLB'
GROUP BY t.id, t.name;
`;
  
  console.log(viewSQL);
}

workingSolution().catch(console.error);