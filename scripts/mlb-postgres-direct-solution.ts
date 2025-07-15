#!/usr/bin/env node
import { Pool } from 'pg';
import axios from 'axios';

// Using PostgreSQL directly from our MCP tools
// Force IPv4 by using the IPv4 address
const pgPool = new Pool({
  host: '13.59.166.180', // IPv4 address for db.pvekvqiqrrpugfmpgaup.supabase.co
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function createMLBPlayerMapping() {
  console.log('🐘 Using Direct PostgreSQL to solve MLB player ID issue\n');
  
  try {
    // 1. Create a mapping table for MLB players
    console.log('Creating MLB player mapping table...');
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS mlb_player_mapping (
        mlb_player_id VARCHAR(50) PRIMARY KEY,
        numeric_id INTEGER UNIQUE NOT NULL,
        player_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Mapping table created');
    
    // 2. Create a view that joins player stats with the mapping
    console.log('\nCreating view for MLB stats...');
    await pgPool.query(`
      CREATE OR REPLACE VIEW mlb_player_stats_view AS
      SELECT 
        ps.*,
        mpm.mlb_player_id,
        mpm.player_name as mlb_player_name
      FROM player_stats ps
      JOIN mlb_player_mapping mpm ON ps.player_id = mpm.numeric_id
      WHERE ps.player_id >= 3000000 AND ps.player_id < 4000000
    `);
    console.log('✅ View created');
    
    // 3. Create a function to get or create numeric ID for MLB player
    console.log('\nCreating helper function...');
    await pgPool.query(`
      CREATE OR REPLACE FUNCTION get_mlb_player_numeric_id(
        p_mlb_id VARCHAR(50),
        p_player_name VARCHAR(255) DEFAULT NULL
      ) RETURNS INTEGER AS $$
      DECLARE
        v_numeric_id INTEGER;
      BEGIN
        -- Check if mapping exists
        SELECT numeric_id INTO v_numeric_id
        FROM mlb_player_mapping
        WHERE mlb_player_id = p_mlb_id;
        
        IF v_numeric_id IS NULL THEN
          -- Create new mapping
          v_numeric_id := 3000000 + CAST(SUBSTRING(p_mlb_id FROM 'mlb_([0-9]+)') AS INTEGER);
          
          INSERT INTO mlb_player_mapping (mlb_player_id, numeric_id, player_name)
          VALUES (p_mlb_id, v_numeric_id, p_player_name)
          ON CONFLICT (mlb_player_id) DO NOTHING;
        END IF;
        
        RETURN v_numeric_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Function created');
    
    // 4. Test with real data
    console.log('\n🧪 Testing with real MLB data...');
    
    // Get a sample game
    const gameResult = await pgPool.query(`
      SELECT id, external_id 
      FROM games 
      WHERE sport = 'MLB' 
      AND status = 'final' 
      ORDER BY start_time DESC 
      LIMIT 1
    `);
    
    if (gameResult.rows.length === 0) {
      console.log('No MLB games found');
      return;
    }
    
    const game = gameResult.rows[0];
    const gamePk = parseInt(game.external_id.replace('mlb_', ''));
    
    console.log(`\nFetching stats for game ${game.id} (MLB: ${gamePk})...`);
    
    // Fetch from MLB API
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    
    // Process a few players as test
    const players = [];
    if (response.data.teams?.home?.players) {
      players.push(...Object.values(response.data.teams.home.players).slice(0, 3));
    }
    
    console.log(`\nProcessing ${players.length} test players...`);
    
    for (const player of players as any[]) {
      const mlbId = `mlb_${player.person.id}`;
      
      // Get numeric ID using our function
      const result = await pgPool.query(
        `SELECT get_mlb_player_numeric_id($1, $2) as numeric_id`,
        [mlbId, player.person.fullName]
      );
      
      const numericId = result.rows[0].numeric_id;
      console.log(`- ${player.person.fullName}: ${mlbId} → ${numericId}`);
      
      // Insert a test stat
      if (player.stats?.batting && player.stats.batting.atBats > 0) {
        await pgPool.query(`
          INSERT INTO player_stats (player_id, game_id, stat_type, stat_value, fantasy_points)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          numericId,
          game.id,
          'batting_avg',
          player.stats.batting.avg || '0.000',
          (player.stats.batting.hits || 0) * 3
        ]);
      }
    }
    
    // 5. Verify the solution
    console.log('\n📊 Verification...');
    
    const mappingCount = await pgPool.query(`
      SELECT COUNT(*) as count FROM mlb_player_mapping
    `);
    
    const statsCount = await pgPool.query(`
      SELECT COUNT(*) as count FROM mlb_player_stats_view
    `);
    
    console.log(`MLB player mappings created: ${mappingCount.rows[0].count}`);
    console.log(`MLB stats accessible via view: ${statsCount.rows[0].count}`);
    
    // Show how to query MLB stats
    console.log('\n💡 To query MLB stats, use:');
    console.log('SELECT * FROM mlb_player_stats_view WHERE mlb_player_name LIKE \'%Ohtani%\'');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgPool.end();
  }
}

// Also create a SQLite local cache option
async function createSQLiteCache() {
  console.log('\n\n📦 Alternative: SQLite Local Cache\n');
  console.log('You could also use the SQLite MCP tool to create a local mapping database:');
  console.log('1. Create local SQLite database with player mappings');
  console.log('2. Sync mappings before inserting stats');
  console.log('3. Use the local cache for fast lookups');
  console.log('\nThis avoids foreign key constraints entirely!');
}

async function main() {
  await createMLBPlayerMapping();
  await createSQLiteCache();
}

main().catch(console.error);