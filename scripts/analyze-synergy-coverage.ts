#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyze() {
  // Check how many games we have
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  console.log('Total completed games:', totalGames);
  
  // Check a sample of games to see player counts
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id')
    .not('home_score', 'is', null)
    .limit(100);
    
  if (!sampleGames) return;
  
  let gamesWithEnoughPlayers = 0;
  let totalTeamGames = 0;
  const sportBreakdown: Record<string, { total: number, withEnough: number }> = {};
  
  for (const game of sampleGames) {
    // Check home team
    const { count: homeCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)
      .eq('team_id', game.home_team_id)
      .gt('minutes', 0);
      
    // Check away team  
    const { count: awayCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)
      .eq('team_id', game.away_team_id)
      .gt('minutes', 0);
      
    // Track by sport
    if (!sportBreakdown[game.sport]) {
      sportBreakdown[game.sport] = { total: 0, withEnough: 0 };
    }
    
    sportBreakdown[game.sport].total += 2;
    totalTeamGames += 2;
    
    if (homeCount && homeCount >= 5) {
      gamesWithEnoughPlayers++;
      sportBreakdown[game.sport].withEnough++;
    }
    if (awayCount && awayCount >= 5) {
      gamesWithEnoughPlayers++;
      sportBreakdown[game.sport].withEnough++;
    }
  }
  
  console.log(`\nSample of 100 games (200 team-games):`);
  console.log(`- Team-games with 5+ players: ${gamesWithEnoughPlayers}`);
  console.log(`- Percentage: ${(gamesWithEnoughPlayers/totalTeamGames*100).toFixed(1)}%`);
  
  console.log('\nBreakdown by sport:');
  for (const [sport, data] of Object.entries(sportBreakdown)) {
    const pct = (data.withEnough / data.total * 100).toFixed(1);
    console.log(`- ${sport}: ${data.withEnough}/${data.total} (${pct}%)`);
  }
  
  // Check distribution of player counts
  const { data: randomGame } = await supabase
    .from('games')
    .select('id, sport')
    .not('home_score', 'is', null)
    .eq('sport', 'nba')
    .limit(1)
    .single();
    
  if (randomGame) {
    const { data: playerCounts } = await supabase
      .from('player_game_logs')
      .select('team_id, player_id')
      .eq('game_id', randomGame.id)
      .gt('minutes', 0);
      
    if (playerCounts) {
      const teamCounts = new Map<string, number>();
      playerCounts.forEach(p => {
        teamCounts.set(p.team_id, (teamCounts.get(p.team_id) || 0) + 1);
      });
      
      console.log(`\nExample NBA game ${randomGame.id}:`);
      for (const [teamId, count] of teamCounts) {
        console.log(`- Team ${teamId}: ${count} players with minutes`);
      }
    }
  }
  
  // Check why we're only getting 775 synergies
  console.log('\n--- SYNERGY CALCULATION ISSUES ---');
  console.log('1. Code limits to 500 games (line 444)');
  console.log('2. Only processes home teams (not away teams)');
  console.log('3. Requires EXACTLY 5 players (not 5+)');
  console.log('4. If we process all games + both teams + 5+ players:');
  
  const estimatedSynergies = Math.floor((totalGames || 0) * 2 * (gamesWithEnoughPlayers/totalTeamGames));
  console.log(`   Estimated synergies: ~${estimatedSynergies}`);
}

analyze().catch(console.error);