import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkNonStandardSports() {
  console.log('🔍 Checking non-standard sport values...\n');

  const query = `
    SELECT sport, COUNT(*) as count
    FROM players
    WHERE sport NOT IN ('NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL', 'NCAA_HKY', 'MILB')
      OR sport IS NULL
    GROUP BY sport
    ORDER BY count DESC;
  `;

  try {
    const result = await pool.query(query);
    
    console.log('Non-standard sport values in players table:');
    console.log('Sport | Count');
    console.log('------|-------');
    
    result.rows.forEach(row => {
      console.log(`${row.sport || 'NULL'} | ${row.count}`);
    });

    // Also check teams and games
    const teamsQuery = query.replace('FROM players', 'FROM teams');
    const gamesQuery = query.replace('FROM players', 'FROM games');

    const teamsResult = await pool.query(teamsQuery);
    const gamesResult = await pool.query(gamesQuery);

    if (teamsResult.rows.length > 0) {
      console.log('\nNon-standard sport values in teams table:');
      teamsResult.rows.forEach(row => {
        console.log(`${row.sport || 'NULL'} | ${row.count}`);
      });
    }

    if (gamesResult.rows.length > 0) {
      console.log('\nNon-standard sport values in games table:');
      gamesResult.rows.forEach(row => {
        console.log(`${row.sport || 'NULL'} | ${row.count}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkNonStandardSports();