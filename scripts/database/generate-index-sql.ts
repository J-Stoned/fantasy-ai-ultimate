#!/usr/bin/env tsx
/**
 * Generate SQL commands for creating indexes
 * Copy and paste the output into Supabase SQL editor
 */

import chalk from 'chalk';

const indexes = [
  // Player game logs - CRITICAL for performance
  `CREATE INDEX IF NOT EXISTS idx_pgl_game_team ON player_game_logs(game_id, team_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pgl_player_game ON player_game_logs(player_id, game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pgl_created ON player_game_logs(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_pgl_game_date ON player_game_logs(game_date);`,
  `CREATE INDEX IF NOT EXISTS idx_pgl_game_team_player ON player_game_logs(game_id, team_id, player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pgl_game_fantasy ON player_game_logs(game_id, fantasy_points DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_pgl_stats_gin ON player_game_logs USING GIN (stats);`,

  // Games table
  `CREATE INDEX IF NOT EXISTS idx_games_external ON games(external_id);`,
  `CREATE INDEX IF NOT EXISTS idx_games_sport_id_time ON games(sport_id, start_time DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_games_teams ON games(home_team_id, away_team_id);`,
  `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);`,
  `CREATE INDEX IF NOT EXISTS idx_games_teams_composite ON games(home_team_id, away_team_id, sport_id, start_time DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_games_metadata_gin ON games USING GIN (metadata);`,

  // Players table
  `CREATE INDEX IF NOT EXISTS idx_players_external ON players(external_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_sport_id ON players(sport_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_name ON players(firstname, lastname);`,
  `CREATE INDEX IF NOT EXISTS idx_players_metadata_gin ON players USING GIN (metadata);`,

  // Teams table
  `CREATE INDEX IF NOT EXISTS idx_teams_external ON teams(external_id);`,
  `CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);`,
  `CREATE INDEX IF NOT EXISTS idx_teams_abbreviation ON teams(abbreviation);`,

  // ML enrichment tables
  `CREATE INDEX IF NOT EXISTS idx_betting_lines_game ON betting_lines(game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_betting_lines_created ON betting_lines(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_betting_lines_timestamp ON betting_lines(timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_weather_data_game ON weather_data(game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_player_injuries_player ON player_injuries(player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_player_injuries_created ON player_injuries(created_at DESC);`,
];

console.log(chalk.bold.cyan('🔥 FANTASY AI DATABASE INDEXES - SQL COMMANDS'));
console.log(chalk.gray('=' .repeat(60)));
console.log();
console.log(chalk.yellow('Instructions:'));
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste these commands');
console.log('4. Run them in batches of 5-10 to avoid timeouts');
console.log();
console.log(chalk.gray('=' .repeat(60)));
console.log();

// Group indexes by table
const groups = {
  'Player Game Logs (Most Critical)': indexes.slice(0, 7),
  'Games Table': indexes.slice(7, 13),
  'Players Table': indexes.slice(13, 18),
  'Teams Table': indexes.slice(18, 21),
  'ML Enrichment Tables': indexes.slice(21),
};

Object.entries(groups).forEach(([groupName, groupIndexes]) => {
  console.log(chalk.bold.green(`\n-- ${groupName}`));
  console.log(chalk.gray('-'.repeat(50)));
  groupIndexes.forEach(sql => {
    console.log(sql);
  });
});

console.log(chalk.bold.green('\n-- Update Statistics After Creating Indexes'));
console.log(chalk.gray('-'.repeat(50)));
console.log('ANALYZE player_game_logs;');
console.log('ANALYZE games;');
console.log('ANALYZE players;');
console.log('ANALYZE teams;');
console.log('ANALYZE betting_lines;');
console.log('ANALYZE weather_data;');
console.log('ANALYZE player_injuries;');

console.log();
console.log(chalk.gray('=' .repeat(60)));
console.log(chalk.bold('Expected Performance Improvements:'));
console.log('  • 10x+ faster queries on player_game_logs');
console.log('  • Significantly improved join performance');
console.log('  • Faster pattern detection queries');
console.log('  • Better API response times');
console.log();
console.log(chalk.yellow('⚠️  Note: Run these in batches to avoid timeouts!'));