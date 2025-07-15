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

async function createMLBTables() {
  console.log('🏗️ CREATING DEDICATED MLB STATS TABLES\n');
  
  // Since we can't run CREATE TABLE directly through Supabase JS client,
  // I'll show the SQL and then we'll work with what we can do
  
  console.log('📋 SQL to create tables (run in Supabase SQL Editor):\n');
  
  const createTablesSQL = `
-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS mlb_stats CASCADE;
DROP TABLE IF EXISTS mlb_players CASCADE;

-- 1. Create MLB players table
CREATE TABLE mlb_players (
  id SERIAL PRIMARY KEY,
  mlb_player_id VARCHAR(50) UNIQUE NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  jersey_number INTEGER,
  current_team VARCHAR(100),
  bat_side VARCHAR(10),
  pitch_hand VARCHAR(10),
  mlb_debut DATE,
  birth_date DATE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create MLB stats table
CREATE TABLE mlb_stats (
  id SERIAL PRIMARY KEY,
  mlb_player_id VARCHAR(50) NOT NULL,
  game_id INTEGER NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_value NUMERIC NOT NULL,
  fantasy_points NUMERIC DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mlb_player_id) REFERENCES mlb_players(mlb_player_id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  UNIQUE(mlb_player_id, game_id, stat_type)
);

-- 3. Create indexes for performance
CREATE INDEX idx_mlb_players_name ON mlb_players(player_name);
CREATE INDEX idx_mlb_players_team ON mlb_players(current_team);
CREATE INDEX idx_mlb_stats_player ON mlb_stats(mlb_player_id);
CREATE INDEX idx_mlb_stats_game ON mlb_stats(game_id);
CREATE INDEX idx_mlb_stats_type ON mlb_stats(stat_type);
CREATE INDEX idx_mlb_stats_fantasy ON mlb_stats(fantasy_points);

-- 4. Create a view for easy querying
CREATE OR REPLACE VIEW mlb_player_game_stats AS
SELECT 
  p.mlb_player_id,
  p.player_name,
  p.position,
  p.current_team,
  g.id as game_id,
  g.external_id as game_external_id,
  g.start_time as game_date,
  g.home_team_id,
  g.away_team_id,
  s.stat_type,
  s.stat_value,
  s.fantasy_points
FROM mlb_stats s
JOIN mlb_players p ON s.mlb_player_id = p.mlb_player_id
JOIN games g ON s.game_id = g.id
WHERE g.sport = 'MLB';

-- 5. Create aggregate stats view
CREATE OR REPLACE VIEW mlb_player_season_stats AS
SELECT 
  p.mlb_player_id,
  p.player_name,
  p.position,
  p.current_team,
  COUNT(DISTINCT s.game_id) as games_played,
  
  -- Batting stats
  SUM(CASE WHEN s.stat_type = 'hits' THEN s.stat_value ELSE 0 END) as total_hits,
  SUM(CASE WHEN s.stat_type = 'home_runs' THEN s.stat_value ELSE 0 END) as total_home_runs,
  SUM(CASE WHEN s.stat_type = 'rbi' THEN s.stat_value ELSE 0 END) as total_rbi,
  SUM(CASE WHEN s.stat_type = 'runs' THEN s.stat_value ELSE 0 END) as total_runs,
  
  -- Pitching stats
  SUM(CASE WHEN s.stat_type = 'innings_pitched' THEN s.stat_value ELSE 0 END) as total_innings_pitched,
  SUM(CASE WHEN s.stat_type = 'strikeouts' THEN s.stat_value ELSE 0 END) as total_strikeouts,
  SUM(CASE WHEN s.stat_type = 'wins' THEN s.stat_value ELSE 0 END) as total_wins,
  
  -- Fantasy
  SUM(s.fantasy_points) as total_fantasy_points,
  AVG(s.fantasy_points) as avg_fantasy_points_per_game
  
FROM mlb_players p
JOIN mlb_stats s ON p.mlb_player_id = s.mlb_player_id
GROUP BY p.mlb_player_id, p.player_name, p.position, p.current_team;
`;

  console.log(createTablesSQL);
  
  console.log('\n⚠️  IMPORTANT: Copy the SQL above and run it in your Supabase SQL Editor');
  console.log('   Go to: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new');
  console.log('   Paste and execute the SQL');
  
  console.log('\n📊 After creating tables, we can populate them...');
}

async function populateMLBData() {
  console.log('\n\n🚀 POPULATING MLB DATA (After tables are created)\n');
  
  // Get a sample game to populate
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(1)
    .single();
    
  if (!sampleGame) {
    console.log('No MLB games found');
    return;
  }
  
  const gamePk = parseInt(sampleGame.external_id.replace('mlb_', ''));
  console.log(`Fetching data for game ${sampleGame.id} (MLB: ${gamePk})...`);
  
  // Fetch game data from MLB API
  const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
  
  // Process players
  const playersToInsert = [];
  const statsToInsert = [];
  
  // Helper function to process team players
  const processTeamPlayers = (teamPlayers: any, teamType: string) => {
    Object.values(teamPlayers || {}).forEach((player: any) => {
      const mlbPlayerId = `mlb_${player.person.id}`;
      
      // Add player
      playersToInsert.push({
        mlb_player_id: mlbPlayerId,
        player_name: player.person.fullName,
        position: player.position?.abbreviation,
        jersey_number: parseInt(player.jerseyNumber) || null,
        current_team: teamType,
        bat_side: player.batSide?.code,
        pitch_hand: player.pitchHand?.code,
        metadata: {
          mlb_id: player.person.id,
          parent_team: teamType
        }
      });
      
      // Add batting stats
      if (player.stats?.batting && player.stats.batting.atBats > 0) {
        const batting = player.stats.batting;
        
        statsToInsert.push({
          mlb_player_id: mlbPlayerId,
          game_id: sampleGame.id,
          stat_type: 'at_bats',
          stat_value: batting.atBats || 0,
          fantasy_points: 0
        });
        
        if (batting.hits > 0) {
          statsToInsert.push({
            mlb_player_id: mlbPlayerId,
            game_id: sampleGame.id,
            stat_type: 'hits',
            stat_value: batting.hits,
            fantasy_points: batting.hits * 3
          });
        }
        
        if (batting.homeRuns > 0) {
          statsToInsert.push({
            mlb_player_id: mlbPlayerId,
            game_id: sampleGame.id,
            stat_type: 'home_runs',
            stat_value: batting.homeRuns,
            fantasy_points: batting.homeRuns * 10
          });
        }
        
        if (batting.rbi > 0) {
          statsToInsert.push({
            mlb_player_id: mlbPlayerId,
            game_id: sampleGame.id,
            stat_type: 'rbi',
            stat_value: batting.rbi,
            fantasy_points: batting.rbi * 2
          });
        }
      }
      
      // Add pitching stats
      if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
        const pitching = player.stats.pitching;
        
        statsToInsert.push({
          mlb_player_id: mlbPlayerId,
          game_id: sampleGame.id,
          stat_type: 'innings_pitched',
          stat_value: parseFloat(pitching.inningsPitched || '0'),
          fantasy_points: parseFloat(pitching.inningsPitched || '0') * 3
        });
        
        if (pitching.strikeOuts > 0) {
          statsToInsert.push({
            mlb_player_id: mlbPlayerId,
            game_id: sampleGame.id,
            stat_type: 'strikeouts',
            stat_value: pitching.strikeOuts,
            fantasy_points: pitching.strikeOuts * 2
          });
        }
      }
    });
  };
  
  // Process both teams
  processTeamPlayers(response.data.teams?.home?.players, response.data.teams?.home?.team?.name || 'home');
  processTeamPlayers(response.data.teams?.away?.players, response.data.teams?.away?.team?.name || 'away');
  
  console.log(`\nReady to insert:`);
  console.log(`- ${playersToInsert.length} players`);
  console.log(`- ${statsToInsert.length} stats`);
  
  // Show sample data
  console.log('\nSample player:');
  console.log(JSON.stringify(playersToInsert[0], null, 2));
  
  console.log('\nSample stats:');
  console.log(JSON.stringify(statsToInsert.slice(0, 3), null, 2));
  
  console.log('\n📝 To insert this data:');
  console.log('1. First run the CREATE TABLE SQL above');
  console.log('2. Then run: npx tsx scripts/populate-mlb-stats.ts');
}

async function main() {
  await createMLBTables();
  await populateMLBData();
  
  console.log('\n\n✅ Next Steps:');
  console.log('1. Copy the SQL and run it in Supabase SQL Editor');
  console.log('2. Come back and run the population script');
  console.log('3. Start analyzing MLB player stats!');
}

main().catch(console.error);