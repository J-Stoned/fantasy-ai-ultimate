import { performance } from 'perf_hooks';
import * as dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL!;

// Parse database URL
const dbMatch = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
if (!dbMatch) throw new Error('Invalid database URL format');

const [, user, password, host, port, database] = dbMatch;

// Direct query execution
async function query(sql: string): Promise<any[]> {
  const { Client } = await import('pg');
  const client = new Client({
    host,
    port: parseInt(port),
    database,
    user,
    password,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function runCleanup() {
  console.log('🏆 STEP 5: STANDARDIZE ESPN IDS (COMPLETE VERSION)');
  console.log('='.repeat(60));

  try {
    // 1. Find misclassified college teams
    console.log('\n📋 Finding misclassified college teams...');
    const misclassified = await query(`
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
    
    console.log(`Found ${misclassified.length} misclassified teams`);
    if (misclassified.length > 0) {
      console.table(misclassified.slice(0, 10));
    }

    // 2. Fix misclassified college teams
    console.log('\n🔧 Fixing misclassified college teams...');
    const nbaFix = await query(`
      UPDATE teams
      SET sport = 'NCAA_BB'
      WHERE sport = 'NBA'
        AND (
          name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%'
          OR name IN ('UCLA Bruins', 'Auburn Tigers', 'Arkansas Razorbacks', 'USC Trojans',
                      'Arizona State Sun Devils', 'UAB Blazers', 'Stanford Cardinal', 
                      'UC San Diego Tritons', 'California Golden Bears', 'Boston College Eagles')
        )
      RETURNING id, name
    `);
    console.log(`Fixed ${nbaFix.length} NBA -> NCAA_BB teams`);

    const nflFix = await query(`
      UPDATE teams
      SET sport = 'NCAA_FB'
      WHERE sport = 'NFL'
        AND (name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%')
      RETURNING id, name
    `);
    console.log(`Fixed ${nflFix.length} NFL -> NCAA_FB teams`);

    // 3. Check for numeric ID conflicts
    console.log('\n🔍 Checking numeric ID conflicts...');
    const conflicts = await query(`
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
    
    if (conflicts.length > 0) {
      console.log(`⚠️  Found ${conflicts.length} conflicts:`);
      console.table(conflicts);
    }

    // 4. Update teams with numeric IDs (no conflicts)
    console.log('\n🔧 Updating teams with numeric IDs...');
    const teamUpdates = await query(`
      UPDATE teams t1
      SET external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
      WHERE t1.external_id ~ '^[0-9]+$'
        AND NOT EXISTS (
          SELECT 1 FROM teams t2 
          WHERE t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
          AND t2.id != t1.id
        )
      RETURNING id, name, sport, external_id
    `);
    console.log(`Updated ${teamUpdates.length} teams`);

    // 5. Update players with numeric IDs
    console.log('\n🔧 Updating players with numeric IDs...');
    const playerUpdates = await query(`
      UPDATE players p1
      SET external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
      WHERE p1.external_id ~ '^[0-9]+$'
        AND p1.sport IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM players p2 
          WHERE p2.external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
          AND p2.id != p1.id
        )
      RETURNING id, sport
    `);
    console.log(`Updated ${playerUpdates.length} players`);

    // 6. Update games with numeric IDs
    console.log('\n🔧 Updating games with numeric IDs...');
    const gameUpdates = await query(`
      UPDATE games g1
      SET external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
      WHERE g1.external_id ~ '^[0-9]+$'
        AND g1.sport IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM games g2 
          WHERE g2.external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
          AND g2.id != g1.id
        )
      RETURNING id, sport
    `);
    console.log(`Updated ${gameUpdates.length} games`);

    // 7. Check NCAA Baseball conflicts
    console.log('\n🔍 Checking NCAA Baseball conflicts...');
    const ncaaConflicts = await query(`
      SELECT COUNT(*) as count
      FROM players p1
      JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE p1.sport = 'NCAA_BASEBALL' 
        AND p1.external_id LIKE 'espn_ncaa_%' 
        AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND p1.id != p2.id
    `);
    console.log(`Found ${ncaaConflicts[0].count} NCAA Baseball conflicts`);

    // 8. Fix NCAA Baseball IDs
    console.log('\n🔧 Fixing NCAA Baseball IDs...');
    const ncaaPlayerFix = await query(`
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
      RETURNING id
    `);
    console.log(`Fixed ${ncaaPlayerFix.length} NCAA Baseball players`);

    const ncaaTeamFix = await query(`
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
      RETURNING id
    `);
    console.log(`Fixed ${ncaaTeamFix.length} NCAA Baseball teams`);

    const ncaaGameFix = await query(`
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
      RETURNING id
    `);
    console.log(`Fixed ${ncaaGameFix.length} NCAA Baseball games`);

    // 9. Final summary
    console.log('\n📊 ID Standardization Summary:');
    
    const standardized = await query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT external_id FROM teams WHERE external_id LIKE 'espn_%_%'
        UNION ALL
        SELECT external_id FROM players WHERE external_id LIKE 'espn_%_%'
        UNION ALL
        SELECT external_id FROM games WHERE external_id LIKE 'espn_%_%'
      ) t
    `);
    console.log(`Total standardized IDs: ${standardized[0].count}`);

    const remaining = await query(`
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
    console.table(remaining);

    // Show samples of remaining issues
    const samples = await query(`
      SELECT 'team' as type, id, name, sport, external_id
      FROM teams 
      WHERE external_id ~ '^[0-9]+$'
      LIMIT 5
    `);
    
    if (samples.length > 0) {
      console.log('\nSample remaining numeric IDs (may have conflicts):');
      console.table(samples);
    }

    console.log('\n✅ ID standardization complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  }
}

runCleanup();