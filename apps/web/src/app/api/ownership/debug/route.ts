/**
 * ULTRA-MINIMAL DEBUG ROUTE TO ISOLATE TYPE MISMATCH
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Minimal database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ULTRA DEBUG] Starting minimal test...');
    
    // Test 1: Basic query
    console.log('🔍 [ULTRA DEBUG] Test 1: Basic player query...');
    const result1 = await pool.query('SELECT COUNT(*) as count FROM players WHERE sport = $1', ['NFL']);
    console.log(`✅ [ULTRA DEBUG] Test 1 passed: ${result1.rows[0].count} NFL players`);
    
    // Test 2: Join with teams
    console.log('🔍 [ULTRA DEBUG] Test 2: Players-Teams join...');
    const result2 = await pool.query(`
      SELECT COUNT(*) as count 
      FROM players p 
      JOIN teams t ON p.team_id = t.id 
      WHERE p.sport = $1
    `, ['NFL']);
    console.log(`✅ [ULTRA DEBUG] Test 2 passed: ${result2.rows[0].count} players with teams`);
    
    // Test 3: Games-Teams join
    console.log('🔍 [ULTRA DEBUG] Test 3: Games-Teams join...');
    const result3 = await pool.query(`
      SELECT COUNT(*) as count 
      FROM games g 
      JOIN teams ht ON g.home_team_id = ht.id::text
      JOIN teams at ON g.away_team_id = at.id::text
      WHERE g.sport = $1
    `, ['NFL']);
    console.log(`✅ [ULTRA DEBUG] Test 3 passed: ${result3.rows[0].count} games with teams`);
    
    // Test 4: Vegas lines join
    console.log('🔍 [ULTRA DEBUG] Test 4: Vegas lines join...');
    const result4 = await pool.query(`
      SELECT COUNT(*) as count 
      FROM vegas_lines vl
      JOIN games g ON vl.game_id = g.game_id
    `);
    console.log(`✅ [ULTRA DEBUG] Test 4 passed: ${result4.rows[0].count} vegas lines`);
    
    return NextResponse.json({
      success: true,
      message: 'All minimal tests passed!',
      results: {
        nfl_players: result1.rows[0].count,
        players_with_teams: result2.rows[0].count,
        games_with_teams: result3.rows[0].count,
        vegas_lines: result4.rows[0].count
      }
    });
    
  } catch (error) {
    console.error('❌ [ULTRA DEBUG] Minimal test failed:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}