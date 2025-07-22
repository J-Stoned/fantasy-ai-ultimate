#!/usr/bin/env tsx
/**
 * 🏈🏒 Calculate Fantasy Points for NFL and NHL
 * Sport-specific scoring rules for each platform
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

// NFL Scoring Rules
const NFL_SCORING = {
  DK: { // DraftKings - Full PPR
    passing_yards: 0.04,
    passing_touchdowns: 4,
    passing_interceptions: -1,
    rushing_yards: 0.1,
    rushing_touchdowns: 6,
    receptions: 1,
    receiving_yards: 0.1,
    receiving_touchdowns: 6,
    fumbles_lost: -1,
    passing_2pt_conversions: 2,
    rushing_2pt_conversions: 2,
    receiving_2pt_conversions: 2,
    kickoff_return_touchdowns: 6,
    punt_return_touchdowns: 6,
    fumble_recovery_touchdowns: 6,
    defensive_interceptions: 2,
    defensive_touchdowns: 6,
    safeties: 2,
    defensive_sacks: 1,
    fumbles_forced: 2,
    fumbles_recovered: 2,
    blocked_kicks: 2
  },
  FD: { // FanDuel - Half PPR
    passing_yards: 0.04,
    passing_touchdowns: 4,
    passing_interceptions: -1,
    rushing_yards: 0.1,
    rushing_touchdowns: 6,
    receptions: 0.5,
    receiving_yards: 0.1,
    receiving_touchdowns: 6,
    fumbles_lost: -2,
    passing_2pt_conversions: 2,
    rushing_2pt_conversions: 2,
    receiving_2pt_conversions: 2
  },
  YAHOO: { // Yahoo - Half PPR
    passing_yards: 0.04,
    passing_touchdowns: 4,
    passing_interceptions: -1,
    rushing_yards: 0.1,
    rushing_touchdowns: 6,
    receptions: 0.5,
    receiving_yards: 0.1,
    receiving_touchdowns: 6,
    fumbles_lost: -2,
    passing_2pt_conversions: 2,
    rushing_2pt_conversions: 2,
    receiving_2pt_conversions: 2
  }
};

// NHL Scoring Rules
const NHL_SCORING = {
  DK: { // DraftKings
    goals: 3,
    assists: 2,
    shots_on_goal: 0.5,
    blocked_shots: 0.5,
    short_handed_goals: 1,
    shootout_goals: 0.2,
    hat_trick_bonus: 1.5,
    // Goalie scoring
    wins: 3,
    saves: 0.2,
    goals_against: -1,
    shutouts: 2,
    overtime_loss: 1
  },
  FD: { // FanDuel
    goals: 3,
    assists: 2,
    shots_on_goal: 0.5,
    blocked_shots: 0.5,
    power_play_points: 0.5,
    short_handed_points: 1,
    // Goalie scoring
    wins: 3,
    saves: 0.2,
    goals_against: -1,
    shutouts: 3
  },
  YAHOO: { // Yahoo
    goals: 3,
    assists: 2,
    plus_minus: 0.5,
    penalty_minutes: 0.5,
    power_play_goals: 0.5,
    power_play_assists: 0.5,
    short_handed_goals: 1,
    short_handed_assists: 1,
    shots_on_goal: 0.1,
    hits: 0.25,
    blocks: 0.5,
    // Goalie scoring
    wins: 5,
    saves: 0.2,
    goals_against: -1,
    shutouts: 3
  }
};

async function calculateFantasyPoints() {
  console.log(chalk.cyan.bold('\n🏈🏒 Calculating Fantasy Points for NFL and NHL\n'));
  
  try {
    // Process NFL
    console.log(chalk.yellow('🏈 Processing NFL...'));
    const nflResult = await processNFL();
    console.log(chalk.green(`✅ NFL: ${nflResult.updated} records updated`));
    
    // Process NHL
    console.log(chalk.yellow('\n🏒 Processing NHL...'));
    const nhlResult = await processNHL();
    console.log(chalk.green(`✅ NHL: ${nhlResult.updated} records updated`));
    
    // Show final stats
    await showFinalStats();
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await pool.end();
  }
}

async function processNFL() {
  const BATCH_SIZE = 10000;
  let totalUpdated = 0;
  let offset = 0;
  
  while (true) {
    // Get batch of NFL records
    const batch = await pool.query(`
      SELECT id, stats, position
      FROM player_game_stats
      WHERE sport = 'NFL'
      AND stats IS NOT NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [BATCH_SIZE, offset]);
    
    if (batch.rows.length === 0) break;
    
    // Calculate points for each record
    const updates = batch.rows.map(row => {
      const stats = row.stats;
      const position = row.position;
      
      // Calculate for each platform
      const dk = calculateNFLPoints(stats, NFL_SCORING.DK, position);
      const fd = calculateNFLPoints(stats, NFL_SCORING.FD, position);
      const yahoo = calculateNFLPoints(stats, NFL_SCORING.YAHOO, position);
      const espn = calculateNFLPoints(stats, NFL_SCORING.FD, position); // ESPN uses similar to FD
      const cbs = calculateNFLPoints(stats, NFL_SCORING.FD, position); // CBS uses similar to FD
      const sleeper = calculateNFLPoints(stats, NFL_SCORING.YAHOO, position); // Sleeper uses similar to Yahoo
      
      return {
        id: row.id,
        dk_points: dk,
        fd_points: fd,
        yahoo_points: yahoo,
        espn_points: espn,
        cbs_points: cbs,
        sleeper_points: sleeper
      };
    });
    
    // Bulk update
    await bulkUpdate(updates);
    totalUpdated += batch.rows.length;
    
    console.log(chalk.gray(`  Processed ${totalUpdated} NFL records...`));
    offset += BATCH_SIZE;
  }
  
  return { updated: totalUpdated };
}

async function processNHL() {
  const BATCH_SIZE = 5000;
  let totalUpdated = 0;
  let offset = 0;
  
  while (true) {
    // Get batch of NHL records
    const batch = await pool.query(`
      SELECT id, stats, position
      FROM player_game_stats
      WHERE sport = 'NHL'
      AND stats IS NOT NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [BATCH_SIZE, offset]);
    
    if (batch.rows.length === 0) break;
    
    // Calculate points for each record
    const updates = batch.rows.map(row => {
      const stats = row.stats;
      const position = row.position;
      const isGoalie = position === 'G';
      
      // Calculate for each platform
      const dk = calculateNHLPoints(stats, NHL_SCORING.DK, isGoalie);
      const fd = calculateNHLPoints(stats, NHL_SCORING.FD, isGoalie);
      const yahoo = calculateNHLPoints(stats, NHL_SCORING.YAHOO, isGoalie);
      const espn = calculateNHLPoints(stats, NHL_SCORING.FD, isGoalie); // ESPN uses similar to FD
      const cbs = calculateNHLPoints(stats, NHL_SCORING.FD, isGoalie); // CBS uses similar to FD
      const sleeper = calculateNHLPoints(stats, NHL_SCORING.YAHOO, isGoalie); // Sleeper uses similar to Yahoo
      
      return {
        id: row.id,
        dk_points: dk,
        fd_points: fd,
        yahoo_points: yahoo,
        espn_points: espn,
        cbs_points: cbs,
        sleeper_points: sleeper
      };
    });
    
    // Bulk update
    await bulkUpdate(updates);
    totalUpdated += batch.rows.length;
    
    console.log(chalk.gray(`  Processed ${totalUpdated} NHL records...`));
    offset += BATCH_SIZE;
  }
  
  return { updated: totalUpdated };
}

function calculateNFLPoints(stats: any, scoring: any, position: string): number {
  let points = 0;
  
  // Go through each stat and apply scoring
  for (const [stat, value] of Object.entries(stats)) {
    if (scoring[stat] && value) {
      points += (value as number) * scoring[stat];
    }
  }
  
  // Handle 300+ yard passing bonus
  if (stats.passing_yards >= 300 && scoring.passing_300_yard_bonus) {
    points += scoring.passing_300_yard_bonus;
  }
  
  // Handle 100+ yard rushing/receiving bonus
  if (stats.rushing_yards >= 100 && scoring.rushing_100_yard_bonus) {
    points += scoring.rushing_100_yard_bonus;
  }
  if (stats.receiving_yards >= 100 && scoring.receiving_100_yard_bonus) {
    points += scoring.receiving_100_yard_bonus;
  }
  
  return Math.round(points * 100) / 100; // Round to 2 decimal places
}

function calculateNHLPoints(stats: any, scoring: any, isGoalie: boolean): number {
  let points = 0;
  
  if (isGoalie) {
    // Goalie scoring
    if (stats.wins && scoring.wins) points += stats.wins * scoring.wins;
    if (stats.saves && scoring.saves) points += stats.saves * scoring.saves;
    if (stats.goals_against && scoring.goals_against) points += stats.goals_against * scoring.goals_against;
    if (stats.shutouts && scoring.shutouts) points += stats.shutouts * scoring.shutouts;
    if (stats.overtime_loss && scoring.overtime_loss) points += stats.overtime_loss * scoring.overtime_loss;
  } else {
    // Skater scoring
    if (stats.goals && scoring.goals) points += stats.goals * scoring.goals;
    if (stats.assists && scoring.assists) points += stats.assists * scoring.assists;
    if (stats.shots && scoring.shots_on_goal) points += stats.shots * scoring.shots_on_goal;
    if (stats.blocks && scoring.blocked_shots) points += stats.blocks * scoring.blocked_shots;
    if (stats.plus_minus && scoring.plus_minus) points += stats.plus_minus * scoring.plus_minus;
    if (stats.pim && scoring.penalty_minutes) points += stats.pim * scoring.penalty_minutes;
    if (stats.hits && scoring.hits) points += stats.hits * scoring.hits;
    
    // Hat trick bonus
    if (stats.goals >= 3 && scoring.hat_trick_bonus) {
      points += scoring.hat_trick_bonus;
    }
  }
  
  return Math.round(points * 100) / 100; // Round to 2 decimal places
}

async function bulkUpdate(updates: any[]) {
  if (updates.length === 0) return;
  
  // Build the UPDATE query
  const values = updates.map(u => 
    `(${u.id}, ${u.dk_points}, ${u.fd_points}, ${u.yahoo_points}, ${u.espn_points}, ${u.cbs_points}, ${u.sleeper_points})`
  ).join(',');
  
  await pool.query(`
    UPDATE player_game_stats AS pgs
    SET 
      dk_points = v.dk_points,
      fd_points = v.fd_points,
      yahoo_points = v.yahoo_points,
      espn_points = v.espn_points,
      cbs_points = v.cbs_points,
      sleeper_points = v.sleeper_points
    FROM (VALUES ${values}) AS v(id, dk_points, fd_points, yahoo_points, espn_points, cbs_points, sleeper_points)
    WHERE pgs.id = v.id
  `);
}

async function showFinalStats() {
  console.log(chalk.cyan.bold('\n📊 Final Statistics:\n'));
  
  const stats = await pool.query(`
    SELECT 
      sport,
      COUNT(*) as total_records,
      COUNT(dk_points) FILTER (WHERE dk_points > 0) as dk_positive,
      COUNT(fd_points) FILTER (WHERE fd_points > 0) as fd_positive,
      ROUND(AVG(dk_points)::numeric, 2) as avg_dk,
      ROUND(AVG(fd_points)::numeric, 2) as avg_fd,
      ROUND(MAX(dk_points)::numeric, 2) as max_dk,
      ROUND(MAX(fd_points)::numeric, 2) as max_fd
    FROM player_game_stats
    WHERE sport IN ('NFL', 'NHL')
    GROUP BY sport
    ORDER BY sport
  `);
  
  console.log(chalk.yellow('Sport | Records | DK>0  | FD>0  | Avg DK | Avg FD | Max DK | Max FD'));
  console.log(chalk.yellow('------|---------|-------|-------|--------|--------|--------|--------'));
  
  stats.rows.forEach(row => {
    console.log(
      `${row.sport.padEnd(5)} | ${row.total_records.toString().padEnd(7)} | ${row.dk_positive.toString().padEnd(5)} | ${row.fd_positive.toString().padEnd(5)} | ${row.avg_dk.toString().padEnd(6)} | ${row.avg_fd.toString().padEnd(6)} | ${row.max_dk.toString().padEnd(6)} | ${row.max_fd}`
    );
  });
}

// Run the calculator
calculateFantasyPoints().catch(console.error);