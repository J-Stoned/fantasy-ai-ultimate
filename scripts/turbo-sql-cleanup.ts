import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  max: 1, // Single connection for sequential operations
});

// Color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

interface CleanupOperation {
  name: string;
  description: string;
  query: string;
  verify?: string;
}

const cleanupOperations: CleanupOperation[] = [
  {
    name: 'Fix NULL sports',
    description: 'Remove records with NULL sport values',
    query: `
      -- Delete players with NULL sport
      DELETE FROM player_game_logs 
      WHERE player_id IN (SELECT id FROM players WHERE sport IS NULL);
      
      DELETE FROM players WHERE sport IS NULL;
      
      -- Delete games with NULL sport
      DELETE FROM games WHERE sport IS NULL;
      
      -- Delete teams with NULL sport
      DELETE FROM teams WHERE sport IS NULL;
    `,
    verify: `
      SELECT 
        'players' as table_name, COUNT(*) as null_count 
      FROM players WHERE sport IS NULL
      UNION ALL
      SELECT 'games', COUNT(*) FROM games WHERE sport IS NULL
      UNION ALL
      SELECT 'teams', COUNT(*) FROM teams WHERE sport IS NULL;
    `
  },
  {
    name: 'Standardize sport names',
    description: 'Fix non-standard sport values',
    query: `
      -- Fix common misspellings and variations
      UPDATE players SET sport = 'NFL' WHERE sport IN ('football', 'Football', 'nfl');
      UPDATE players SET sport = 'NBA' WHERE sport IN ('basketball', 'Basketball', 'nba');
      UPDATE players SET sport = 'MLB' WHERE sport IN ('baseball', 'Baseball', 'mlb');
      UPDATE players SET sport = 'NHL' WHERE sport IN ('hockey', 'Hockey', 'nhl');
      
      UPDATE teams SET sport = 'NFL' WHERE sport IN ('football', 'Football', 'nfl');
      UPDATE teams SET sport = 'NBA' WHERE sport IN ('basketball', 'Basketball', 'nba');
      UPDATE teams SET sport = 'MLB' WHERE sport IN ('baseball', 'Baseball', 'mlb');
      UPDATE teams SET sport = 'NHL' WHERE sport IN ('hockey', 'Hockey', 'nhl');
      
      UPDATE games SET sport = 'NFL' WHERE sport IN ('football', 'Football', 'nfl');
      UPDATE games SET sport = 'NBA' WHERE sport IN ('basketball', 'Basketball', 'nba');
      UPDATE games SET sport = 'MLB' WHERE sport IN ('baseball', 'Baseball', 'mlb');
      UPDATE games SET sport = 'NHL' WHERE sport IN ('hockey', 'Hockey', 'nhl');
    `,
    verify: `
      SELECT DISTINCT sport, COUNT(*) as count
      FROM (
        SELECT sport FROM players
        UNION ALL
        SELECT sport FROM teams
        UNION ALL
        SELECT sport FROM games
      ) all_sports
      WHERE sport NOT IN ('NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL', 'NCAA_HKY', 'MILB')
      GROUP BY sport;
    `
  },
  {
    name: 'Remove duplicate teams',
    description: 'Keep only one team per name/sport combination',
    query: `
      -- Create temp table with teams to keep
      CREATE TEMP TABLE teams_to_keep AS
      SELECT DISTINCT ON (name, sport) id
      FROM teams
      WHERE sport IS NOT NULL
      ORDER BY name, sport, id;
      
      -- Update players to point to keeper teams
      UPDATE players p
      SET team_id = tk.id
      FROM teams t1
      JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
        AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
      WHERE p.team_id = t1.id AND t1.id != tk.id;
      
      -- Update games home teams
      UPDATE games g
      SET home_team_id = tk.id
      FROM teams t1
      JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
        AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
      WHERE g.home_team_id = t1.id AND t1.id != tk.id;
      
      -- Update games away teams
      UPDATE games g
      SET away_team_id = tk.id
      FROM teams t1
      JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
        AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
      WHERE g.away_team_id = t1.id AND t1.id != tk.id;
      
      -- Delete duplicate teams
      DELETE FROM teams WHERE id NOT IN (SELECT id FROM teams_to_keep);
      
      DROP TABLE teams_to_keep;
    `,
    verify: `
      SELECT name, sport, COUNT(*) as count
      FROM teams
      GROUP BY name, sport
      HAVING COUNT(*) > 1;
    `
  },
  {
    name: 'Remove duplicate games',
    description: 'Keep only one game per team matchup and date',
    query: `
      -- Delete duplicate games keeping the one with most stats
      DELETE FROM games g1
      WHERE EXISTS (
        SELECT 1
        FROM games g2
        WHERE g1.home_team_id = g2.home_team_id
          AND g1.away_team_id = g2.away_team_id
          AND DATE(g1.date) = DATE(g2.date)
          AND g1.id > g2.id
      );
    `,
    verify: `
      SELECT home_team_id, away_team_id, DATE(date) as game_date, COUNT(*) as count
      FROM games
      WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
      GROUP BY home_team_id, away_team_id, DATE(date)
      HAVING COUNT(*) > 1;
    `
  },
  {
    name: 'Remove empty stats',
    description: 'Delete player_game_logs with no actual stats',
    query: `
      DELETE FROM player_game_logs
      WHERE stats IS NULL OR stats::text = '{}';
    `,
    verify: `
      SELECT COUNT(*) as empty_stats_count
      FROM player_game_logs
      WHERE stats IS NULL OR stats::text = '{}';
    `
  },
  {
    name: 'Fix orphaned stats',
    description: 'Remove stats pointing to non-existent players or games',
    query: `
      -- Delete stats with missing players
      DELETE FROM player_game_logs pgl
      WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id);
      
      -- Delete stats with missing games
      DELETE FROM player_game_logs pgl
      WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);
    `,
    verify: `
      SELECT 
        'missing_players' as issue,
        COUNT(*) as count
      FROM player_game_logs pgl
      WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id)
      UNION ALL
      SELECT 
        'missing_games',
        COUNT(*)
      FROM player_game_logs pgl
      WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);
    `
  },
  {
    name: 'Standardize ESPN IDs',
    description: 'Fix external_id format to match espn_sport_id pattern',
    query: `
      -- Fix numeric-only external IDs
      UPDATE teams 
      SET external_id = 
        CASE 
          WHEN sport = 'NFL' THEN 'espn_nfl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'NBA' THEN 'espn_nba_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'MLB' THEN 'espn_mlb_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'NHL' THEN 'espn_nhl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          ELSE external_id
        END
      WHERE external_id ~ '^[0-9]+$';
      
      UPDATE players 
      SET external_id = 
        CASE 
          WHEN sport = 'NFL' THEN 'espn_nfl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'NBA' THEN 'espn_nba_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'MLB' THEN 'espn_mlb_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'NHL' THEN 'espn_nhl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          ELSE external_id
        END
      WHERE external_id ~ '^[0-9]+$';
      
      UPDATE games 
      SET external_id = 
        CASE 
          WHEN sport = 'NFL' THEN 'espn_nfl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'NBA' THEN 'espn_nba_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'MLB' THEN 'espn_mlb_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          WHEN sport = 'NHL' THEN 'espn_nhl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
          ELSE external_id
        END
      WHERE external_id ~ '^[0-9]+$';
      
      -- Fix NCAA misformatted IDs
      UPDATE players SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';
      
      UPDATE teams SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';
      
      UPDATE games SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';
    `,
    verify: `
      SELECT 'non_standard_ids' as issue, COUNT(*) as count
      FROM (
        SELECT external_id FROM teams WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
        UNION ALL
        SELECT external_id FROM players WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
        UNION ALL
        SELECT external_id FROM games WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
      ) t;
    `
  }
];

async function runCleanup() {
  console.log(`${colors.bright}${colors.cyan}🚀 TURBO SQL CLEANUP - DIRECT DATABASE OPERATIONS${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const startTime = Date.now();
  const results: any[] = [];

  try {
    // Start transaction
    await pool.query('BEGIN');

    for (const operation of cleanupOperations) {
      console.log(`${colors.blue}▶ ${operation.name}${colors.reset}`);
      console.log(`  ${colors.white}${operation.description}${colors.reset}`);

      const opStart = Date.now();

      try {
        // Run the cleanup query
        const result = await pool.query(operation.query);
        const duration = ((Date.now() - opStart) / 1000).toFixed(2);

        // Verify if provided
        let verifyResult = null;
        if (operation.verify) {
          verifyResult = await pool.query(operation.verify);
        }

        results.push({
          name: operation.name,
          success: true,
          duration,
          result,
          verifyResult
        });

        console.log(`  ${colors.green}✓ Completed in ${duration}s${colors.reset}`);
        
        if (verifyResult && verifyResult.rows.length > 0) {
          console.log(`  ${colors.yellow}Remaining issues:${colors.reset}`);
          verifyResult.rows.forEach((row: any) => {
            console.log(`    ${JSON.stringify(row)}`);
          });
        }

      } catch (error: any) {
        console.log(`  ${colors.red}✗ Failed: ${error.message}${colors.reset}`);
        results.push({
          name: operation.name,
          success: false,
          error: error.message
        });
      }

      console.log('');
    }

    // Commit transaction
    await pool.query('COMMIT');
    console.log(`${colors.green}✅ All changes committed to database${colors.reset}\n`);

  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error(`${colors.red}Error during cleanup, rolled back all changes: ${error}${colors.reset}`);
  } finally {
    await pool.end();
  }

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`${colors.bright}${colors.magenta}📊 CLEANUP SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  console.log(`Total operations: ${results.length}`);
  console.log(`${colors.green}Successful: ${successful}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total time: ${duration}s`);

  if (successful === results.length) {
    console.log(`\n${colors.bright}${colors.green}🎉 DATABASE CLEANUP COMPLETED SUCCESSFULLY!${colors.reset}`);
  } else {
    console.log(`\n${colors.bright}${colors.yellow}⚠️  Some operations failed. Check the logs above.${colors.reset}`);
  }
}

// Run if called directly
if (require.main === module) {
  runCleanup().catch(console.error);
}

export { runCleanup };