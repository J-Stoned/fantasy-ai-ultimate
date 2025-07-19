import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function runCleanup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🏆 STEP 5: STANDARDIZE ESPN IDS');
    console.log('='.repeat(60));

    // Start transaction
    await client.query('BEGIN');

    // 1. Find misclassified college teams
    console.log('\n📋 Finding misclassified college teams...');
    const misclassified = await client.query(`
      SELECT id, name, sport, external_id
      FROM teams
      WHERE (sport IN ('NBA', 'NFL', 'MLB', 'NHL'))
        AND (
          name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%'
          OR name IN ('UCLA Bruins', 'Auburn Tigers', 'Arkansas Razorbacks', 'USC Trojans',
                      'Arizona State Sun Devils', 'UAB Blazers', 'Stanford Cardinal', 
                      'UC San Diego Tritons', 'California Golden Bears', 'Boston College Eagles')
        )
    `);
    
    console.log(`Found ${misclassified.rows.length} misclassified teams`);
    if (misclassified.rows.length > 0) {
      console.table(misclassified.rows.slice(0, 10));
    }

    // 2. Fix misclassified college teams
    console.log('\n🔧 Fixing misclassified college teams...');
    const nbaFix = await client.query(`
      UPDATE teams
      SET sport = 'NCAA_BB'
      WHERE sport = 'NBA'
        AND (
          name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%'
          OR name IN ('UCLA Bruins', 'Auburn Tigers', 'Arkansas Razorbacks', 'USC Trojans',
                      'Arizona State Sun Devils', 'UAB Blazers', 'Stanford Cardinal', 
                      'UC San Diego Tritons', 'California Golden Bears', 'Boston College Eagles')
        )
    `);
    console.log(`Fixed ${nbaFix.rowCount} NBA -> NCAA_BB teams`);

    const nflFix = await client.query(`
      UPDATE teams
      SET sport = 'NCAA_FB'
      WHERE sport = 'NFL'
        AND (name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%')
    `);
    console.log(`Fixed ${nflFix.rowCount} NFL -> NCAA_FB teams`);

    // 3. Check for numeric ID conflicts
    console.log('\n🔍 Checking numeric ID conflicts...');
    const conflicts = await client.query(`
      WITH conflict_check AS (
        SELECT 
          t1.id,
          t1.name,
          t1.sport,
          t1.external_id,
          'espn_' || LOWER(t1.sport) || '_' || t1.external_id as proposed_id,
          t2.id as conflict_id,
          t2.name as conflict_name
        FROM teams t1
        LEFT JOIN teams t2 ON t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
        WHERE t1.external_id ~ '^[0-9]+$'
      )
      SELECT * FROM conflict_check WHERE conflict_id IS NOT NULL
    `);
    
    if (conflicts.rows.length > 0) {
      console.log(`⚠️  Found ${conflicts.rows.length} conflicts:`);
      console.table(conflicts.rows);
    }

    // 4. Update teams with numeric IDs (no conflicts)
    console.log('\n🔧 Updating teams with numeric IDs...');
    const teamUpdates = await client.query(`
      UPDATE teams t1
      SET external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
      WHERE t1.external_id ~ '^[0-9]+$'
        AND NOT EXISTS (
          SELECT 1 FROM teams t2 
          WHERE t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
          AND t2.id != t1.id
        )
    `);
    console.log(`Updated ${teamUpdates.rowCount} teams`);

    // 5. Update players with numeric IDs
    console.log('\n🔧 Updating players with numeric IDs...');
    const playerUpdates = await client.query(`
      UPDATE players p1
      SET external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
      WHERE p1.external_id ~ '^[0-9]+$'
        AND p1.sport IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM players p2 
          WHERE p2.external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
          AND p2.id != p1.id
        )
    `);
    console.log(`Updated ${playerUpdates.rowCount} players`);

    // 6. Update games with numeric IDs
    console.log('\n🔧 Updating games with numeric IDs...');
    const gameUpdates = await client.query(`
      UPDATE games g1
      SET external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
      WHERE g1.external_id ~ '^[0-9]+$'
        AND g1.sport IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM games g2 
          WHERE g2.external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
          AND g2.id != g1.id
        )
    `);
    console.log(`Updated ${gameUpdates.rowCount} games`);

    // 7. Check NCAA Baseball conflicts
    console.log('\n🔍 Checking NCAA Baseball conflicts...');
    const ncaaConflicts = await client.query(`
      SELECT COUNT(*) as count
      FROM players p1
      JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE p1.sport = 'NCAA_BASEBALL' 
        AND p1.external_id LIKE 'espn_ncaa_%' 
        AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND p1.id != p2.id
    `);
    console.log(`Found ${ncaaConflicts.rows[0].count} NCAA Baseball conflicts`);

    // 8. Fix NCAA Baseball IDs
    console.log('\n🔧 Fixing NCAA Baseball IDs...');
    const ncaaPlayerFix = await client.query(`
      UPDATE players
      SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND NOT EXISTS (
          SELECT 1 FROM players p2 
          WHERE p2.external_id = REPLACE(players.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
          AND p2.id != players.id
        )
    `);
    console.log(`Fixed ${ncaaPlayerFix.rowCount} NCAA Baseball players`);

    const ncaaTeamFix = await client.query(`
      UPDATE teams
      SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND NOT EXISTS (
          SELECT 1 FROM teams t2 
          WHERE t2.external_id = REPLACE(teams.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
          AND t2.id != teams.id
        )
    `);
    console.log(`Fixed ${ncaaTeamFix.rowCount} NCAA Baseball teams`);

    const ncaaGameFix = await client.query(`
      UPDATE games
      SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND NOT EXISTS (
          SELECT 1 FROM games g2 
          WHERE g2.external_id = REPLACE(games.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
          AND g2.id != games.id
        )
    `);
    console.log(`Fixed ${ncaaGameFix.rowCount} NCAA Baseball games`);

    // 9. Final summary
    console.log('\n📊 ID Standardization Summary:');
    
    const standardized = await client.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT external_id FROM teams WHERE external_id LIKE 'espn_%_%'
        UNION ALL
        SELECT external_id FROM players WHERE external_id LIKE 'espn_%_%'
        UNION ALL
        SELECT external_id FROM games WHERE external_id LIKE 'espn_%_%'
      ) t
    `);
    console.log(`Total standardized IDs: ${standardized.rows[0].count}`);

    const remaining = await client.query(`
      SELECT 
        'Numeric teams' as type,
        COUNT(*) as count
      FROM teams 
      WHERE external_id ~ '^[0-9]+$'
      UNION ALL
      SELECT 
        'Numeric players',
        COUNT(*)
      FROM players 
      WHERE external_id ~ '^[0-9]+$'
      UNION ALL
      SELECT 
        'Numeric games',
        COUNT(*)
      FROM games 
      WHERE external_id ~ '^[0-9]+$'
      UNION ALL
      SELECT 
        'NCAA Baseball needing fix',
        COUNT(*)
      FROM teams
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
    `);
    
    console.log('\nRemaining non-standard IDs:');
    console.table(remaining.rows);

    // Show samples of remaining issues
    const samples = await client.query(`
      SELECT 'team' as type, id, name, sport, external_id
      FROM teams 
      WHERE external_id ~ '^[0-9]+$'
      LIMIT 5
    `);
    
    if (samples.rows.length > 0) {
      console.log('\nSample remaining numeric IDs (may have conflicts):');
      console.table(samples.rows);
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ ID standardization complete!');

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runCleanup();