#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateNFLStats() {
  console.log('🔍 Investigating Missing NFL Stats...\n');

  // 1. Check overall stats distribution
  console.log('1️⃣ Overall NFL Game Stats Distribution:');
  const { data: statsDistribution, error: distError } = await supabase
    .rpc('get_nfl_stats_distribution');
  
  if (distError) {
    // Try alternative query
    const { data: gameStats, error: gameError } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .eq('sport', 'NFL');
    
    if (!gameError && gameStats) {
      const statsByGame = gameStats.reduce((acc: any, stat) => {
        acc[stat.game_id] = (acc[stat.game_id] || 0) + 1;
        return acc;
      }, {});
      
      const counts = Object.values(statsByGame) as number[];
      console.log(`Total games: ${Object.keys(statsByGame).length}`);
      console.log(`Average stats per game: ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)}`);
      console.log(`Min stats: ${Math.min(...counts)}`);
      console.log(`Max stats: ${Math.max(...counts)}`);
    }
  } else if (statsDistribution) {
    console.log(statsDistribution);
  }

  // 2. Find games with different stat counts
  console.log('\n2️⃣ Finding Example Games:');
  
  // Find a game with 60+ stats
  const { data: highStatGames } = await supabase
    .from('player_game_logs')
    .select('game_id, COUNT(*)')
    .eq('sport', 'NFL')
    .groupBy('game_id')
    .having('COUNT(*) >= 60')
    .limit(1);

  // Find a game with <50 stats
  const { data: lowStatGames } = await supabase
    .from('player_game_logs')
    .select('game_id, COUNT(*)')
    .eq('sport', 'NFL')
    .groupBy('game_id')
    .having('COUNT(*) < 50')
    .limit(1);

  // Alternative approach - get all games and analyze
  const { data: allGames, error: allGamesError } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, game_date')
    .eq('sport', 'NFL')
    .order('game_date', { ascending: false })
    .limit(100);

  if (allGames && !allGamesError) {
    // Count stats for each game
    const gameStatsCount = await Promise.all(
      allGames.map(async (game) => {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        return { game_id: game.id, count: count || 0, date: game.game_date };
      })
    );

    // Sort by count
    gameStatsCount.sort((a, b) => b.count - a.count);
    
    const highStatGame = gameStatsCount[0];
    const lowStatGame = gameStatsCount[gameStatsCount.length - 1];
    
    console.log(`High stat game: ${highStatGame.game_id} with ${highStatGame.count} stats (${highStatGame.date})`);
    console.log(`Low stat game: ${lowStatGame.game_id} with ${lowStatGame.count} stats (${lowStatGame.date})`);

    // 3. Analyze the high stat game
    console.log('\n3️⃣ Analyzing High Stat Game:');
    const { data: highStats } = await supabase
      .from('player_game_logs')
      .select(`
        *,
        player:players!player_id (
          name,
          position,
          team_id
        )
      `)
      .eq('game_id', highStatGame.game_id);

    if (highStats) {
      const positionCounts: any = {};
      const statTypes: Set<string> = new Set();
      
      highStats.forEach((stat: any) => {
        const position = stat.player?.position || 'Unknown';
        positionCounts[position] = (positionCounts[position] || 0) + 1;
        
        // Check which stat types have values
        if (stat.passing_yards > 0) statTypes.add('passing');
        if (stat.rushing_yards > 0) statTypes.add('rushing');
        if (stat.receiving_yards > 0) statTypes.add('receiving');
        if (stat.tackles > 0 || stat.sacks > 0 || stat.interceptions > 0) statTypes.add('defensive');
        if (stat.field_goals_made > 0 || stat.extra_points_made > 0) statTypes.add('kicking');
        if (stat.punt_yards > 0) statTypes.add('punting');
      });

      console.log('Positions in high stat game:', positionCounts);
      console.log('Stat types present:', Array.from(statTypes));
    }

    // 4. Analyze the low stat game
    console.log('\n4️⃣ Analyzing Low Stat Game:');
    const { data: lowStats } = await supabase
      .from('player_game_logs')
      .select(`
        *,
        player:players!player_id (
          name,
          position,
          team_id
        )
      `)
      .eq('game_id', lowStatGame.game_id);

    if (lowStats) {
      const positionCounts: any = {};
      const statTypes: Set<string> = new Set();
      
      lowStats.forEach((stat: any) => {
        const position = stat.player?.position || 'Unknown';
        positionCounts[position] = (positionCounts[position] || 0) + 1;
        
        // Check which stat types have values
        if (stat.passing_yards > 0) statTypes.add('passing');
        if (stat.rushing_yards > 0) statTypes.add('rushing');
        if (stat.receiving_yards > 0) statTypes.add('receiving');
        if (stat.tackles > 0 || stat.sacks > 0 || stat.interceptions > 0) statTypes.add('defensive');
        if (stat.field_goals_made > 0 || stat.extra_points_made > 0) statTypes.add('kicking');
        if (stat.punt_yards > 0) statTypes.add('punting');
      });

      console.log('Positions in low stat game:', positionCounts);
      console.log('Stat types present:', Array.from(statTypes));
    }

    // 5. Check player_game_logs structure
    console.log('\n5️⃣ Player Game Logs Table Structure:');
    const { data: tableInfo } = await supabase
      .from('player_game_logs')
      .select('*')
      .eq('sport', 'NFL')
      .limit(1);

    if (tableInfo && tableInfo.length > 0) {
      const columns = Object.keys(tableInfo[0]);
      console.log('Total columns:', columns.length);
      console.log('Stat columns:', columns.filter(col => 
        !['id', 'player_id', 'game_id', 'team_id', 'sport', 'created_at', 'updated_at'].includes(col)
      ));
    }

    // 6. Check for systematic missing positions
    console.log('\n6️⃣ Overall Position Distribution in NFL:');
    const { data: allPositions } = await supabase
      .from('player_game_logs')
      .select(`
        player:players!player_id (
          position
        )
      `)
      .eq('sport', 'NFL');

    if (allPositions) {
      const positionTotals: any = {};
      allPositions.forEach((stat: any) => {
        const position = stat.player?.position || 'Unknown';
        positionTotals[position] = (positionTotals[position] || 0) + 1;
      });
      
      console.log('Total position counts across all NFL games:');
      Object.entries(positionTotals)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([pos, count]) => {
          console.log(`  ${pos}: ${count}`);
        });
    }

    // 7. Check if offensive linemen are tracked
    console.log('\n7️⃣ Checking for Offensive Linemen:');
    const offensiveLinePositions = ['C', 'OG', 'OT', 'G', 'T', 'OL'];
    const { data: oLineStats } = await supabase
      .from('player_game_logs')
      .select(`
        *,
        player:players!player_id (
          name,
          position
        )
      `)
      .eq('sport', 'NFL')
      .in('player.position', offensiveLinePositions)
      .limit(10);

    console.log(`Found ${oLineStats?.length || 0} offensive lineman stats`);
    if (oLineStats && oLineStats.length > 0) {
      console.log('Sample O-Line stats:', oLineStats[0]);
    }
  }
}

investigateNFLStats().catch(console.error);