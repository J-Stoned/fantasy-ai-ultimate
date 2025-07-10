#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debug100Accuracy() {
  console.log('🔍 DEBUGGING 100% ACCURACY ISSUE');
  console.log('================================\n');

  // Load games and financial data
  const { data: teamsWithFinance } = await supabase
    .from('teams')
    .select('id, metadata')
    .not('metadata->cap_percentage_2024', 'is', null);
  
  console.log(`Teams with financial data: ${teamsWithFinance?.length}`);

  // Check games with scores
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .in('sport_id', ['nfl', 'nba'])
    .limit(100);

  console.log(`\nAnalyzing ${games?.length} games...\n`);

  // Analyze score patterns
  let zeroZeroGames = 0;
  let tieGames = 0;
  let homeWins = 0;
  let awayWins = 0;
  let gamesWithFinance = 0;
  let sameScoreGames: any[] = [];

  games?.forEach(game => {
    if (game.home_score === 0 && game.away_score === 0) {
      zeroZeroGames++;
    }
    if (game.home_score === game.away_score) {
      tieGames++;
      if (sameScoreGames.length < 5) {
        sameScoreGames.push(game);
      }
    }
    if (game.home_score > game.away_score) homeWins++;
    if (game.away_score > game.home_score) awayWins++;

    // Check if teams have financial data
    const hasFinance = teamsWithFinance?.some(t => 
      t.id === game.home_team_id || t.id === game.away_team_id
    );
    if (hasFinance) gamesWithFinance++;
  });

  console.log('📊 Score Pattern Analysis:');
  console.log(`0-0 games: ${zeroZeroGames}`);
  console.log(`Tie games: ${tieGames}`);
  console.log(`Home wins: ${homeWins}`);
  console.log(`Away wins: ${awayWins}`);
  console.log(`Games with financial data: ${gamesWithFinance}`);

  if (sameScoreGames.length > 0) {
    console.log('\n🎯 Sample tie games:');
    sameScoreGames.forEach(g => {
      console.log(`  ${g.home_team} vs ${g.away_team}: ${g.home_score}-${g.away_score}`);
    });
  }

  // Check if all games have the same outcome
  if (homeWins === games?.length) {
    console.log('\n⚠️  WARNING: All games are home wins!');
  }
  if (awayWins === games?.length) {
    console.log('\n⚠️  WARNING: All games are away wins!');
  }
  if (tieGames === games?.length) {
    console.log('\n⚠️  WARNING: All games are ties!');
  }

  // Check unique scores
  const uniqueScores = new Set<string>();
  games?.forEach(g => {
    uniqueScores.add(`${g.home_score}-${g.away_score}`);
  });
  
  console.log(`\n📈 Unique score combinations: ${uniqueScores.size}`);
  if (uniqueScores.size < 10) {
    console.log('Sample scores:', Array.from(uniqueScores).slice(0, 10).join(', '));
  }

  // Check financial data distribution
  console.log('\n💰 Financial Data Check:');
  const capPercentages = teamsWithFinance?.map(t => 
    t.metadata?.cap_percentage_2024
  ).filter(Boolean) || [];
  
  if (capPercentages.length > 0) {
    const avgCap = capPercentages.reduce((a, b) => a + b, 0) / capPercentages.length;
    const minCap = Math.min(...capPercentages);
    const maxCap = Math.max(...capPercentages);
    
    console.log(`Average cap %: ${avgCap.toFixed(1)}%`);
    console.log(`Min cap %: ${minCap.toFixed(1)}%`);
    console.log(`Max cap %: ${maxCap.toFixed(1)}%`);
  }

  // The real issue check
  console.log('\n🚨 POTENTIAL ISSUES:');
  if (uniqueScores.size === 1) {
    console.log('- All games have the same score!');
  }
  if (tieGames > games!.length * 0.5) {
    console.log('- Too many tie games (>50%)');
  }
  if (gamesWithFinance < games!.length * 0.5) {
    console.log('- Less than 50% of games have financial data');
  }
  if (homeWins > games!.length * 0.9 || awayWins > games!.length * 0.9) {
    console.log('- Extreme home/away bias');
  }
}

debug100Accuracy();