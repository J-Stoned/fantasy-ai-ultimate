#!/usr/bin/env tsx
/**
 * Fix NBA stats collection - handle the "X-Y" format for shooting stats
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

const apiLimit = pLimit(20);

async function fixNBAStats() {
  console.log(chalk.cyan.bold('\n🏀 Fixing NBA Stats Collection\n'));
  
  try {
    // Get the games we need to re-collect
    const games = await pool.query(`
      SELECT DISTINCT
        g.*,
        ht.espn_id as home_espn_id,
        at.espn_id as away_espn_id
      FROM games_master g
      JOIN teams_master ht ON g.home_team_id = ht.id
      JOIN teams_master at ON g.away_team_id = at.id
      WHERE g.sport = 'NBA'
      AND g.status = 'STATUS_FINAL'
      AND g.espn_game_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM player_game_stats pgs 
        WHERE pgs.game_id = g.id
        AND pgs.dk_points = 0
        AND pgs.created_at > NOW() - INTERVAL '2 hours'
      )
      ORDER BY g.game_date
    `);
    
    console.log(chalk.yellow(`Found ${games.rows.length} NBA games to re-collect\n`));
    
    let totalFixed = 0;
    
    for (const game of games.rows) {
      console.log(chalk.gray(`  Fixing ${game.espn_game_id} from ${game.game_date}...`));
      const fixed = await fixGameStats(game);
      totalFixed += fixed;
    }
    
    console.log(chalk.green.bold(`\n✅ Fixed ${totalFixed} NBA stats!`));
    
    // Calculate fantasy points for the fixed stats
    console.log(chalk.yellow('\n📊 Calculating fantasy points...'));
    
    const updateResult = await pool.query(`
      UPDATE player_game_stats
      SET 
        dk_points = ROUND((
          COALESCE((stats->>'points')::FLOAT * 1, 0) +
          COALESCE((stats->>'rebounds')::FLOAT * 1.25, 0) +
          COALESCE((stats->>'assists')::FLOAT * 1.5, 0) +
          COALESCE((stats->>'steals')::FLOAT * 2, 0) +
          COALESCE((stats->>'blocks')::FLOAT * 2, 0) +
          COALESCE((stats->>'turnovers')::FLOAT * -0.5, 0) +
          CASE 
            WHEN (stats->>'rebounds')::INT >= 10 AND (
              ((stats->>'points')::INT >= 10 AND (stats->>'assists')::INT >= 10) OR
              ((stats->>'points')::INT >= 10 AND (stats->>'rebounds')::INT >= 10) OR
              ((stats->>'assists')::INT >= 10 AND (stats->>'rebounds')::INT >= 10)
            ) THEN 1.5
            ELSE 0
          END
        )::NUMERIC, 2),
        fd_points = dk_points,
        yahoo_points = dk_points,
        espn_points = dk_points,
        cbs_points = dk_points,
        sleeper_points = dk_points,
        updated_at = NOW()
      WHERE sport = 'NBA'
      AND dk_points = 0
      AND stats IS NOT NULL
      AND (stats->>'points')::INT > 0
      AND created_at > NOW() - INTERVAL '2 hours'
    `);
    
    console.log(chalk.green(`✅ Updated fantasy points for ${updateResult.rowCount} records`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pool.end();
  }
}

async function fixGameStats(game: any): Promise<number> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espn_game_id}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore?.players) {
      return 0;
    }
    
    // First, delete the bad stats
    await pool.query('DELETE FROM player_game_stats WHERE game_id = $1', [game.id]);
    
    const stats: any[] = [];
    
    for (const teamData of response.data.boxscore.players) {
      const teamId = teamData.team.id === game.home_espn_id 
        ? game.home_team_id 
        : game.away_team_id;
      
      for (const category of teamData.statistics || []) {
        for (const player of category.athletes || []) {
          if (!player.stats || player.stats.length < 13) continue;
          
          // Skip DNP players
          if (player.stats[0] === 'DNP' || player.stats[0] === '0') continue;
          
          const values = player.stats;
          
          // Parse shooting stats properly
          const parseFGStat = (stat: any) => {
            if (typeof stat === 'string' && stat.includes('-')) {
              const parts = stat.split('-');
              return {
                made: parseInt(parts[0]) || 0,
                attempted: parseInt(parts[1]) || 0
              };
            }
            return { made: 0, attempted: 0 };
          };
          
          const fg = parseFGStat(values[1]);
          const three = parseFGStat(values[2]);
          const ft = parseFGStat(values[3]);
          
          const playerStats = {
            player_id: await getOrCreatePlayer(player.athlete, teamId, 'NBA'),
            game_id: game.id,
            team_id: teamId,
            opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
            sport: 'NBA',
            season: game.season,
            position: player.athlete?.position?.abbreviation || 'F',
            played: true,
            started: player.starter || false,
            stats: {
              minutes: values[0] || '0',
              field_goals_made: fg.made,
              field_goals_attempted: fg.attempted,
              three_pointers_made: three.made,
              three_pointers_attempted: three.attempted,
              free_throws_made: ft.made,
              free_throws_attempted: ft.attempted,
              offensive_rebounds: parseInt(values[4]) || 0,
              defensive_rebounds: parseInt(values[5]) || 0,
              rebounds: parseInt(values[6]) || 0,
              assists: parseInt(values[7]) || 0,
              steals: parseInt(values[8]) || 0,
              blocks: parseInt(values[9]) || 0,
              turnovers: parseInt(values[10]) || 0,
              personal_fouls: parseInt(values[11]) || 0,
              points: parseInt(values[12]) || 0,
              plus_minus: parseInt(values[13]) || 0
            },
            data_source: 'espn_api',
            confidence_score: 0.95
          };
          
          if (playerStats.player_id) {
            stats.push(playerStats);
          }
        }
      }
    }
    
    if (stats.length > 0) {
      await insertStats(stats);
      return stats.length;
    }
    
    return 0;
    
  } catch (error: any) {
    console.log(chalk.red(`    Failed: ${error.message}`));
    return 0;
  }
}

async function getOrCreatePlayer(athlete: any, teamId: number, sport: string): Promise<number | null> {
  if (!athlete?.id || !athlete?.displayName) return null;
  
  try {
    const existing = await pool.query(
      'SELECT id FROM players_master WHERE espn_id = $1',
      [parseInt(athlete.id)]
    );
    
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
    
    const result = await pool.query(`
      INSERT INTO players_master (
        our_player_id, name, sport, team_id, position, espn_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      `${sport}_${athlete.id}`,
      athlete.displayName,
      sport,
      teamId,
      athlete.position?.abbreviation || 'F',
      parseInt(athlete.id),
      'active'
    ]);
    
    return result.rows[0].id;
    
  } catch (error) {
    console.error('Failed to create player:', error);
    return null;
  }
}

async function insertStats(stats: any[]) {
  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;
  
  stats.forEach(stat => {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    values.push(
      stat.game_id,
      stat.player_id,
      stat.team_id,
      stat.opponent_id,
      stat.sport,
      stat.season,
      stat.position,
      stat.played,
      stat.started,
      stat.stats,
      stat.data_source,
      stat.confidence_score
    );
  });
  
  await pool.query(`
    INSERT INTO player_game_stats (
      game_id, player_id, team_id, opponent_id, sport, season,
      position, played, started, stats, data_source, confidence_score
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (game_id, player_id) DO NOTHING
  `, values);
}

// Run the fixer
fixNBAStats().catch(console.error);