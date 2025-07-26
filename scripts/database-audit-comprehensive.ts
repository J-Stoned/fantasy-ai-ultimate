import { Pool } from 'pg';

interface DataQualityIssue {
  table: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  examples?: any[];
  recommendation: string;
}

async function comprehensiveDatabaseAudit() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai',
    user: 'fantasy_user',
    password: 'fantasy_password'
  });

  const issues: DataQualityIssue[] = [];

  try {
    console.log('🔍 Starting Comprehensive Database Audit...\n');
    
    // ========== PLAYERS TABLE ANALYSIS ==========
    console.log('📊 PLAYERS TABLE ANALYSIS');
    console.log('=' .repeat(50));
    
    // Basic counts by sport
    const sportCounts = await pool.query(`
      SELECT sport, COUNT(*) as count 
      FROM players 
      GROUP BY sport 
      ORDER BY count DESC;
    `);
    
    console.log('\n🏆 Players by Sport:');
    sportCounts.rows.forEach(row => {
      console.log(`  - ${row.sport || 'NULL'}: ${row.count}`);
    });
    
    // NFL Position analysis
    const nflPositions = await pool.query(`
      SELECT position, COUNT(*) as count 
      FROM players 
      WHERE sport = 'NFL' 
      GROUP BY position 
      ORDER BY count DESC;
    `);
    
    console.log('\n🏈 NFL Players by Position:');
    nflPositions.rows.forEach(row => {
      console.log(`  - ${row.position || 'NULL'}: ${row.count}`);
    });
    
    // Check for duplicate players (same name + position + team)
    const duplicates = await pool.query(`
      SELECT name, position, team, COUNT(*) as duplicate_count
      FROM players 
      WHERE sport = 'NFL' AND name IS NOT NULL
      GROUP BY name, position, team
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 20;
    `);
    
    if (duplicates.rows.length > 0) {
      issues.push({
        table: 'players',
        issue: 'Duplicate players found',
        severity: 'high',
        count: duplicates.rows.length,
        examples: duplicates.rows.slice(0, 5),
        recommendation: 'Merge duplicate player records and establish unique constraints'
      });
      
      console.log('\n⚠️  DUPLICATE PLAYERS DETECTED:');
      duplicates.rows.slice(0, 10).forEach(dup => {
        console.log(`  - ${dup.name} (${dup.position}) - ${dup.team}: ${dup.duplicate_count} records`);
      });
    }
    
    // Check for missing critical data
    const missingData = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) - COUNT(name) as missing_name,
        COUNT(*) - COUNT(position) as missing_position,
        COUNT(*) - COUNT(team) as missing_team,
        COUNT(*) - COUNT(photo_url) as missing_photo,
        COUNT(*) - COUNT(avatar_2d_url) as missing_2d_avatar,
        COUNT(*) - COUNT(avatar_3d_url) as missing_3d_avatar
      FROM players 
      WHERE sport = 'NFL';
    `);
    
    const missing = missingData.rows[0];
    console.log('\n📋 Missing Data Analysis (NFL):');
    console.log(`  - Total NFL players: ${missing.total}`);
    console.log(`  - Missing name: ${missing.missing_name} (${((missing.missing_name/missing.total)*100).toFixed(1)}%)`);
    console.log(`  - Missing position: ${missing.missing_position} (${((missing.missing_position/missing.total)*100).toFixed(1)}%)`);
    console.log(`  - Missing team: ${missing.missing_team} (${((missing.missing_team/missing.total)*100).toFixed(1)}%)`);
    console.log(`  - Missing photo_url: ${missing.missing_photo} (${((missing.missing_photo/missing.total)*100).toFixed(1)}%)`);
    console.log(`  - Missing 2D avatar: ${missing.missing_2d_avatar} (${((missing.missing_2d_avatar/missing.total)*100).toFixed(1)}%)`);
    console.log(`  - Missing 3D avatar: ${missing.missing_3d_avatar} (${((missing.missing_3d_avatar/missing.total)*100).toFixed(1)}%)`);
    
    // Check for invalid/suspicious data
    const invalidPositions = await pool.query(`
      SELECT position, COUNT(*) as count
      FROM players 
      WHERE sport = 'NFL' 
      AND position NOT IN ('QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST', 'OL', 'DL', 'LB', 'DB', 'S', 'CB', 'DE', 'DT', 'OT', 'OG', 'C', 'FB', 'P', 'LS')
      GROUP BY position
      ORDER BY count DESC;
    `);
    
    if (invalidPositions.rows.length > 0) {
      issues.push({
        table: 'players',
        issue: 'Invalid/unusual positions found',
        severity: 'medium',
        count: invalidPositions.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        examples: invalidPositions.rows.slice(0, 5),
        recommendation: 'Standardize position names and validate against known NFL positions'
      });
    }
    
    // Check team data consistency
    const teamVariations = await pool.query(`
      SELECT team, COUNT(*) as count
      FROM players 
      WHERE sport = 'NFL' AND team IS NOT NULL
      GROUP BY team
      ORDER BY count DESC;
    `);
    
    console.log('\n🏟️  Team Distribution (Top 20):');
    teamVariations.rows.slice(0, 20).forEach(team => {
      console.log(`  - ${team.team}: ${team.count} players`);
    });
    
    // Check for retired/inactive players (might explain high count)
    const statusAnalysis = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM players 
      WHERE sport = 'NFL'
      GROUP BY status
      ORDER BY count DESC;
    `);
    
    console.log('\n👤 Player Status Analysis:');
    statusAnalysis.rows.forEach(status => {
      console.log(`  - ${status.status || 'NULL'}: ${status.count}`);
    });
    
    // ========== GAME LOGS ANALYSIS ==========
    console.log('\n\n📈 GAME LOGS ANALYSIS');
    console.log('=' .repeat(50));
    
    const gameLogStats = await pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT player_id) as unique_players,
        MIN(game_date) as earliest_game,
        MAX(game_date) as latest_game,
        COUNT(DISTINCT week) as total_weeks,
        AVG(fantasy_points_ppr) as avg_fantasy_points
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      WHERE p.sport = 'NFL';
    `);
    
    const logStats = gameLogStats.rows[0];
    console.log(`\n📊 Game Log Statistics:`);
    console.log(`  - Total game logs: ${logStats.total_logs}`);
    console.log(`  - Unique NFL players with logs: ${logStats.unique_players}`);
    console.log(`  - Date range: ${logStats.earliest_game} to ${logStats.latest_game}`);
    console.log(`  - Total weeks: ${logStats.total_weeks}`);
    console.log(`  - Average fantasy points: ${parseFloat(logStats.avg_fantasy_points).toFixed(2)}`);
    
    // Check for players with no game logs
    const playersWithoutLogs = await pool.query(`
      SELECT COUNT(*) as count
      FROM players p
      LEFT JOIN player_game_logs pgl ON p.id = pgl.player_id
      WHERE p.sport = 'NFL' AND pgl.player_id IS NULL;
    `);
    
    console.log(`  - NFL players without game logs: ${playersWithoutLogs.rows[0].count}`);
    
    if (parseInt(playersWithoutLogs.rows[0].count) > 1000) {
      issues.push({
        table: 'players/game_logs',
        issue: 'Large number of players without game logs',
        severity: 'medium',
        count: parseInt(playersWithoutLogs.rows[0].count),
        recommendation: 'These might be historical, practice squad, or incorrectly imported players'
      });
    }
    
    // Check for current active players (those with recent game logs)
    const activePlayers = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as active_count
      FROM players p
      JOIN player_game_logs pgl ON p.id = pgl.player_id
      WHERE p.sport = 'NFL' 
      AND pgl.game_date >= '2023-09-01'
      AND pgl.fantasy_points_ppr > 0;
    `);
    
    console.log(`  - NFL players with recent activity (2023+): ${activePlayers.rows[0].active_count}`);
    
    // ========== DATA QUALITY ISSUES SUMMARY ==========
    console.log('\n\n🚨 DATA QUALITY ISSUES SUMMARY');
    console.log('=' .repeat(50));
    
    if (issues.length === 0) {
      console.log('✅ No major data quality issues detected!');
    } else {
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.issue.toUpperCase()} (${issue.severity.toUpperCase()})`);
        console.log(`   Table: ${issue.table}`);
        console.log(`   Count: ${issue.count}`);
        console.log(`   Recommendation: ${issue.recommendation}`);
        if (issue.examples) {
          console.log(`   Examples:`, issue.examples.slice(0, 3));
        }
      });
    }
    
    // ========== RECOMMENDATIONS ==========
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('=' .repeat(50));
    
    const totalPlayers = parseInt(missing.total);
    const activeCount = parseInt(activePlayers.rows[0].active_count);
    const playersWithoutLogsCount = parseInt(playersWithoutLogs.rows[0].count);
    
    console.log('\n📋 Database Optimization Recommendations:');
    
    if (totalPlayers > 5000) {
      console.log(`\n1. 🔍 EXCESSIVE PLAYER COUNT`);
      console.log(`   - You have ${totalPlayers} NFL players, but typically should have ~1,700-2,000 active`);
      console.log(`   - Only ${activeCount} have recent game logs`);
      console.log(`   - ${playersWithoutLogsCount} have no game logs at all`);
      console.log(`   - RECOMMENDATION: Archive historical/inactive players to separate table`);
    }
    
    if (duplicates.rows.length > 0) {
      console.log(`\n2. 🔗 DUPLICATE PLAYER CLEANUP`);
      console.log(`   - Found ${duplicates.rows.length} sets of duplicate players`);
      console.log(`   - RECOMMENDATION: Implement deduplication process`);
    }
    
    if (parseInt(missing.missing_photo) / totalPlayers > 0.8) {
      console.log(`\n3. 🖼️  MISSING AVATAR DATA`);
      console.log(`   - ${((missing.missing_photo/totalPlayers)*100).toFixed(1)}% missing photos`);
      console.log(`   - RECOMMENDATION: Prioritize avatar data for active players only`);
    }
    
    console.log('\n✅ Database audit complete!');
    
  } catch (error) {
    console.error('❌ Database audit failed:', error);
  } finally {
    await pool.end();
  }
}

comprehensiveDatabaseAudit();