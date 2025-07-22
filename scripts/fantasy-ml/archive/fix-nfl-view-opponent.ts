import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function fixNFLViewWithOpponent() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Fixing v_nfl_player_stats view to include opponent column...\n');

    // First, let's check the current view definition
    const currentViewResult = await pool.query(`
      SELECT pg_get_viewdef('v_nfl_player_stats'::regclass, true) as definition;
    `);

    console.log('📋 Current view definition:');
    console.log(currentViewResult.rows[0].definition);
    console.log('\n');

    // Drop the existing view
    console.log('🗑️  Dropping existing view...');
    await pool.query('DROP VIEW IF EXISTS v_nfl_player_stats CASCADE;');

    // Create the new view with opponent column
    console.log('✨ Creating new view with opponent column...');
    const createViewQuery = `
      CREATE OR REPLACE VIEW v_nfl_player_stats AS
      SELECT 
        p.id AS player_id,
        p.name,
        p.position,
        gl.team,
        gl.opponent,  -- Adding opponent column
        gl.game_date,
        gl.stats,
        -- NFL specific stats extracted from JSONB
        (gl.stats->>'passing_yards')::integer AS passing_yards,
        (gl.stats->>'passing_touchdowns')::integer AS passing_touchdowns,
        (gl.stats->>'rushing_yards')::integer AS rushing_yards,
        (gl.stats->>'rushing_touchdowns')::integer AS rushing_touchdowns,
        (gl.stats->>'receptions')::integer AS receptions,
        (gl.stats->>'receiving_yards')::integer AS receiving_yards,
        (gl.stats->>'receiving_touchdowns')::integer AS receiving_touchdowns,
        (gl.stats->>'targets')::integer AS targets,
        -- Calculate fantasy points (DraftKings scoring)
        COALESCE(
          -- Passing: 1 point per 25 yards, 4 points per TD, -1 per INT
          (gl.stats->>'passing_yards')::numeric / 25 +
          (gl.stats->>'passing_touchdowns')::numeric * 4 -
          COALESCE((gl.stats->>'interceptions')::numeric, 0) +
          -- Rushing: 1 point per 10 yards, 6 points per TD
          (gl.stats->>'rushing_yards')::numeric / 10 +
          (gl.stats->>'rushing_touchdowns')::numeric * 6 +
          -- Receiving: 1 point per 10 yards, 6 points per TD, 1 point per reception
          (gl.stats->>'receiving_yards')::numeric / 10 +
          (gl.stats->>'receiving_touchdowns')::numeric * 6 +
          (gl.stats->>'receptions')::numeric +
          -- Bonuses
          CASE WHEN (gl.stats->>'passing_yards')::numeric >= 300 THEN 3 ELSE 0 END +
          CASE WHEN (gl.stats->>'rushing_yards')::numeric >= 100 THEN 3 ELSE 0 END +
          CASE WHEN (gl.stats->>'receiving_yards')::numeric >= 100 THEN 3 ELSE 0 END,
          0
        ) AS calculated_fantasy_points
      FROM game_logs gl
      INNER JOIN players p ON p.external_id = gl.player_id
      WHERE p.sport = 'nfl'
        AND gl.stats IS NOT NULL;
    `;

    await pool.query(createViewQuery);
    console.log('✅ View created successfully!\n');

    // Verify the new view structure
    const newColumnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'v_nfl_player_stats'
      ORDER BY ordinal_position;
    `);

    console.log('📋 New view columns:');
    newColumnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Test the view with sample data
    const sampleResult = await pool.query(`
      SELECT player_id, name, position, team, opponent, game_date, calculated_fantasy_points
      FROM v_nfl_player_stats 
      WHERE opponent IS NOT NULL
      LIMIT 5;
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\n📊 Sample data from updated view:');
      sampleResult.rows.forEach(row => {
        console.log(`  ${row.name} (${row.position}) - ${row.team} vs ${row.opponent} on ${row.game_date}: ${row.calculated_fantasy_points} pts`);
      });
    }

    // Count total records
    const countResult = await pool.query('SELECT COUNT(*) FROM v_nfl_player_stats;');
    console.log(`\n✅ Total records in view: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error fixing view:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixNFLViewWithOpponent().catch(console.error);