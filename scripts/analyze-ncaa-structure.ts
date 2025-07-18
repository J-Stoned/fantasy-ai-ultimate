#\!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL\!,
  process.env.SUPABASE_SERVICE_ROLE_KEY\!
);

async function analyzeNCAAStructure() {
  console.log(chalk.cyan('\n🏀🏈⚾ NCAA DATABASE STRUCTURE ANALYSIS\n'));

  // 1. Check teams for each NCAA sport
  console.log(chalk.yellow('1. NCAA Teams by Sport:'));
  const { data: ncaaTeams } = await supabase
    .from('teams')
    .select('id, name, city, abbreviation, sport, external_id')
    .or('sport.eq.NCAA_FB,sport.eq.NCAA_BB,sport.eq.NCAA_BASEBALL')
    .order('sport');

  const teamsBySport = ncaaTeams?.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  Object.entries(teamsBySport).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} teams`);
  });

  // Sample team structure
  console.log(chalk.gray('\nSample NCAA team:'));
  if (ncaaTeams && ncaaTeams.length > 0) {
    console.log(JSON.stringify(ncaaTeams[0], null, 2));
  }

  // 2. Check games for each NCAA sport
  console.log(chalk.yellow('\n2. NCAA Games by Sport:'));
  const { data: ncaaGames, count: totalGames } = await supabase
    .from('games')
    .select('id, sport, external_id, metadata', { count: 'exact' })
    .or('sport.eq.NCAA_FB,sport.eq.NCAA_BB,sport.eq.NCAA_BASEBALL')
    .limit(1000);

  const gamesBySport = ncaaGames?.reduce((acc, game) => {
    acc[game.sport] = (acc[game.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  Object.entries(gamesBySport).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} games`);
  });

  // Check for 2021 season data
  console.log(chalk.yellow('\n3. 2021 Season Data:'));
  const games2021 = ncaaGames?.filter(g => g.metadata?.season === '2021' || g.metadata?.season === 2021) || [];
  const games2021BySport = games2021.reduce((acc, game) => {
    acc[game.sport] = (acc[game.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(games2021BySport).forEach(([sport, count]) => {
    console.log(`  ${sport} 2021: ${count} games`);
  });

  if (Object.keys(games2021BySport).length === 0) {
    console.log(chalk.red('  No 2021 NCAA games found\!'));
  }

  // Sample game structure
  console.log(chalk.gray('\nSample NCAA game:'));
  if (ncaaGames && ncaaGames.length > 0) {
    console.log(JSON.stringify(ncaaGames[0], null, 2));
  }

  // 3. Check players for NCAA sports
  console.log(chalk.yellow('\n4. NCAA Players:'));
  const { data: ncaaPlayers, count: playerCount } = await supabase
    .from('players')
    .select('id, name, sport, team_id, external_id', { count: 'exact' })
    .or('sport.eq.NCAA_FB,sport.eq.NCAA_BB,sport.eq.NCAA_BASEBALL')
    .limit(100);

  const playersBySport = ncaaPlayers?.reduce((acc, player) => {
    acc[player.sport] = (acc[player.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log(`  Total NCAA players in sample: ${ncaaPlayers?.length || 0}`);
  Object.entries(playersBySport).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} players`);
  });

  // 4. Check player stats
  console.log(chalk.yellow('\n5. NCAA Player Stats:'));
  const { data: ncaaStats, count: statsCount } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_id, stats', { count: 'exact' })
    .in('player_id', ncaaPlayers?.map(p => p.id) || [])
    .limit(10);

  console.log(`  Found ${statsCount || 0} stats for NCAA players`);

  // 5. External ID format analysis
  console.log(chalk.yellow('\n6. External ID Formats:'));
  
  console.log('\n  Team external_ids:');
  const teamIdSamples = ncaaTeams?.slice(0, 3).map(t => ({
    name: t.name,
    external_id: t.external_id
  }));
  console.log(JSON.stringify(teamIdSamples, null, 2));

  console.log('\n  Game external_ids:');
  const gameIdSamples = ncaaGames?.slice(0, 3).map(g => ({
    sport: g.sport,
    external_id: g.external_id
  }));
  console.log(JSON.stringify(gameIdSamples, null, 2));

  // 6. Check for NULL values
  console.log(chalk.yellow('\n7. NULL Value Analysis:'));
  const nullAnalysis = {
    teamsWithNullSport: ncaaTeams?.filter(t => \!t.sport).length || 0,
    teamsWithNullExternalId: ncaaTeams?.filter(t => \!t.external_id).length || 0,
    gamesWithNullSport: ncaaGames?.filter(g => \!g.sport).length || 0,
    gamesWithNullExternalId: ncaaGames?.filter(g => \!g.external_id).length || 0,
  };
  console.log(JSON.stringify(nullAnalysis, null, 2));

  // 7. Metadata structure
  console.log(chalk.yellow('\n8. Metadata Structure:'));
  const sampleMetadata = ncaaGames?.find(g => g.metadata && Object.keys(g.metadata).length > 0)?.metadata;
  if (sampleMetadata) {
    console.log('Sample game metadata:', JSON.stringify(sampleMetadata, null, 2));
  }

  // Summary
  console.log(chalk.cyan('\n📊 SUMMARY:'));
  console.log(`Total NCAA teams: ${ncaaTeams?.length || 0}`);
  console.log(`Total NCAA games: ${totalGames || 0}`);
  console.log(`2021 games: ${games2021.length}`);
  console.log(`NCAA players found: ${playerCount || 0}`);
}

analyzeNCAAStructure().catch(console.error);
