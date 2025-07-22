import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function fixNFLViewProperly() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Fixing v_nfl_player_stats view with proper opponent information...\n');

    // First, let's check teams table to understand opponent_id relationship
    const teamsInfoResult = await pool.query(`
      SELECT id, name, abbreviation, sport
      FROM teams
      WHERE sport = 'NFL'
      ORDER BY name
      LIMIT 5;
    `);

    console.log('📋 Sample NFL teams:');
    teamsInfoResult.rows.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation}): id=${team.id}`);
    });

    // Drop the existing view
    console.log('\n🗑️  Dropping existing view...');
    await pool.query('DROP VIEW IF EXISTS v_nfl_player_stats CASCADE;');

    // Create the new view with opponent information from teams table
    console.log('✨ Creating new view with opponent column from teams table...');
    const createViewQuery = `
      CREATE OR REPLACE VIEW v_nfl_player_stats AS
      SELECT 
        p.id AS player_id,
        p.name,
        p.position,
        p.team,
        t.name AS opponent,  -- Get opponent name from teams table
        t.abbreviation AS opponent_abbr,  -- Also include abbreviation
        pgl.game_date::date AS game_date,
        pgl.stats::jsonb AS stats,
        -- NFL specific stats extracted from JSONB
        (pgl.stats::jsonb->>'passing_yards')::integer AS passing_yards,
        (pgl.stats::jsonb->>'passing_touchdowns')::integer AS passing_touchdowns,
        (pgl.stats::jsonb->>'rushing_yards')::integer AS rushing_yards,
        (pgl.stats::jsonb->>'rushing_touchdowns')::integer AS rushing_touchdowns,
        (pgl.stats::jsonb->>'receptions')::integer AS receptions,
        (pgl.stats::jsonb->>'receiving_yards')::integer AS receiving_yards,
        (pgl.stats::jsonb->>'receiving_touchdowns')::integer AS receiving_touchdowns,
        (pgl.stats::jsonb->>'targets')::integer AS targets,
        -- Calculate fantasy points (DraftKings scoring)
        COALESCE(
          -- Passing: 1 point per 25 yards, 4 points per TD, -1 per INT
          (pgl.stats::jsonb->>'passing_yards')::numeric / 25 +
          (pgl.stats::jsonb->>'passing_touchdowns')::numeric * 4 -
          COALESCE((pgl.stats::jsonb->>'interceptions')::numeric, 0) +
          -- Rushing: 1 point per 10 yards, 6 points per TD
          (pgl.stats::jsonb->>'rushing_yards')::numeric / 10 +
          (pgl.stats::jsonb->>'rushing_touchdowns')::numeric * 6 +
          -- Receiving: 1 point per 10 yards, 6 points per TD, 1 point per reception
          (pgl.stats::jsonb->>'receiving_yards')::numeric / 10 +
          (pgl.stats::jsonb->>'receiving_touchdowns')::numeric * 6 +
          (pgl.stats::jsonb->>'receptions')::numeric +
          -- Bonuses
          CASE WHEN (pgl.stats::jsonb->>'passing_yards')::numeric >= 300 THEN 3 ELSE 0 END +
          CASE WHEN (pgl.stats::jsonb->>'rushing_yards')::numeric >= 100 THEN 3 ELSE 0 END +
          CASE WHEN (pgl.stats::jsonb->>'receiving_yards')::numeric >= 100 THEN 3 ELSE 0 END,
          0
        ) AS calculated_fantasy_points
      FROM players p
      INNER JOIN player_game_logs pgl ON p.id = pgl.player_id
      LEFT JOIN teams t ON pgl.opponent_id = t.id
      WHERE p.sport = 'NFL'
        AND pgl.stats IS NOT NULL;
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
      SELECT player_id, name, position, team, opponent, opponent_abbr, game_date, calculated_fantasy_points
      FROM v_nfl_player_stats 
      WHERE opponent IS NOT NULL
      LIMIT 5;
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\n📊 Sample data from updated view:');
      sampleResult.rows.forEach(row => {
        console.log(`  ${row.name} (${row.position}) - ${row.team} vs ${row.opponent} (${row.opponent_abbr}) on ${row.game_date}: ${row.calculated_fantasy_points} pts`);
      });
    }

    // Count total records
    const countResult = await pool.query('SELECT COUNT(*) FROM v_nfl_player_stats;');
    console.log(`\n✅ Total records in view: ${countResult.rows[0].count}`);

    // Check records with null opponents
    const nullOpponentResult = await pool.query(`
      SELECT COUNT(*) FROM v_nfl_player_stats WHERE opponent IS NULL;
    `);
    console.log(`⚠️  Records with NULL opponent: ${nullOpponentResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error fixing view:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixNFLViewProperly().catch(console.error);