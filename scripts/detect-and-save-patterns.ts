#!/usr/bin/env tsx
/**
 * 🎯 DETECT AND SAVE PATTERNS TO GAMES
 * 
 * Analyzes all completed games and saves detected patterns to metadata
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function detectAndSavePatterns() {
  console.log(chalk.cyan.bold('\n🎯 DETECTING AND SAVING PATTERNS TO GAMES\n'));
  
  let processed = 0;
  let patternsFound = 0;
  let gamesWithPatterns = 0;
  
  // Process in chunks
  const chunkSize = 100;
  let hasMore = true;
  let offset = 0;
  
  while (hasMore) {
    // Get chunk of completed games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MLB')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(offset, offset + chunkSize - 1);
    
    if (!games || games.length === 0) {
      hasMore = false;
      break;
    }
    
    // Process each game
    for (const game of games) {
      const patterns = await detectGamePatterns(game);
      
      if (patterns.length > 0) {
        // Update game with patterns
        const { error } = await supabase
          .from('games')
          .update({
            metadata: {
              ...game.metadata,
              has_pattern: true,
              pattern_types: patterns,
              pattern_confidence: calculatePatternConfidence(patterns)
            }
          })
          .eq('id', game.id);
        
        if (!error) {
          gamesWithPatterns++;
          patternsFound += patterns.length;
        }
      }
    }
    
    processed += games.length;
    offset += chunkSize;
    
    if (processed % 500 === 0) {
      console.log(chalk.gray(`Processed ${processed} games... (${gamesWithPatterns} with patterns)`));
    }
    
    if (games.length < chunkSize) {
      hasMore = false;
    }
  }
  
  console.log(chalk.green.bold('\n✅ PATTERN DETECTION COMPLETE!\n'));
  console.log(chalk.white(`Total games processed: ${processed}`));
  console.log(chalk.white(`Games with patterns: ${gamesWithPatterns}`));
  console.log(chalk.white(`Total patterns found: ${patternsFound}`));
  console.log(chalk.white(`Average patterns per game: ${(patternsFound / gamesWithPatterns).toFixed(2)}`));
  
  // Show pattern breakdown
  const { data: patternGames } = await supabase
    .from('games')
    .select('metadata')
    .not('metadata->has_pattern', 'is', null);
  
  const patternCounts: Record<string, number> = {};
  patternGames?.forEach(g => {
    const patterns = g.metadata?.pattern_types || [];
    patterns.forEach((p: string) => {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
  });
  
  console.log(chalk.yellow('\n📊 Pattern Distribution:'));
  Object.entries(patternCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([pattern, count]) => {
      console.log(chalk.white(`  ${pattern}: ${count} games`));
    });
}

async function detectGamePatterns(game: any): Promise<string[]> {
  const patterns: string[] = [];
  
  // 1. Altitude advantage (Coors Field)
  if (game.venue?.toLowerCase().includes('coors')) {
    patterns.push('altitude_advantage');
  }
  
  // 2. Back-to-back games
  const gameDate = new Date(game.start_time);
  const yesterday = new Date(gameDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if home team played yesterday
  const { data: homeYesterday } = await supabase
    .from('games')
    .select('id')
    .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id}`)
    .gte('start_time', yesterday.toISOString())
    .lt('start_time', game.start_time)
    .eq('status', 'completed')
    .limit(1);
  
  // Check if away team played yesterday
  const { data: awayYesterday } = await supabase
    .from('games')
    .select('id')
    .or(`home_team_id.eq.${game.away_team_id},away_team_id.eq.${game.away_team_id}`)
    .gte('start_time', yesterday.toISOString())
    .lt('start_time', game.start_time)
    .eq('status', 'completed')
    .limit(1);
  
  if (homeYesterday && homeYesterday.length > 0) {
    patterns.push('back_to_back_fade');
    if (!game.metadata) game.metadata = {};
    game.metadata.is_home_back_to_back = true;
  } else if (awayYesterday && awayYesterday.length > 0) {
    patterns.push('back_to_back_fade');
    if (!game.metadata) game.metadata = {};
    game.metadata.is_away_back_to_back = true;
  }
  
  // 3. Embarrassment revenge
  // Check if either team lost by 5+ runs in their last game
  const { data: homeLastGame } = await supabase
    .from('games')
    .select('*')
    .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id}`)
    .lt('start_time', game.start_time)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .single();
  
  if (homeLastGame) {
    const wasHome = homeLastGame.home_team_id === game.home_team_id;
    const theirScore = wasHome ? homeLastGame.home_score : homeLastGame.away_score;
    const oppScore = wasHome ? homeLastGame.away_score : homeLastGame.home_score;
    
    if (oppScore - theirScore >= 5) {
      patterns.push('embarrassment_revenge');
      if (!game.metadata) game.metadata = {};
      game.metadata.revenge_team = 'home';
    }
  }
  
  // 4. Division rivalry
  const { data: teams } = await supabase
    .from('teams')
    .select('id, division')
    .in('id', [game.home_team_id, game.away_team_id]);
  
  if (teams && teams.length === 2 && teams[0].division === teams[1].division) {
    patterns.push('division_rivalry');
  }
  
  // 5. Home underdog (would need odds data)
  // For now, we'll skip this as it requires odds information
  
  // 6. Primetime under (night games)
  const gameHour = new Date(game.start_time).getHours();
  if (gameHour >= 19) { // 7 PM or later
    patterns.push('primetime_under');
  }
  
  return patterns;
}

function calculatePatternConfidence(patterns: string[]): number {
  const confidences: Record<string, number> = {
    'altitude_advantage': 0.683,
    'back_to_back_fade': 0.768,
    'embarrassment_revenge': 0.744,
    'division_rivalry': 0.556,
    'home_underdog': 0.612,
    'primetime_under': 0.621
  };
  
  if (patterns.length === 0) return 0;
  
  const totalConfidence = patterns.reduce((sum, pattern) => 
    sum + (confidences[pattern] || 0.5), 0
  );
  
  return totalConfidence / patterns.length;
}

// Run the detection
detectAndSavePatterns().catch(console.error);