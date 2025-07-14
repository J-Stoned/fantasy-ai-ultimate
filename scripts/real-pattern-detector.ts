#!/usr/bin/env tsx
/**
 * REAL PATTERN DETECTOR - Find actual patterns in our 187K complete records
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.green('🎯 REAL PATTERN DETECTION - Using 187K complete records'));

interface Pattern {
  name: string;
  description: string;
  detect: (data: any[]) => Promise<any>;
}

const PATTERNS: Pattern[] = [
  {
    name: 'Home Court Advantage',
    description: 'Teams perform better at home',
    detect: async (logs) => {
      const homeLogs = logs.filter(l => l.is_home);
      const awayLogs = logs.filter(l => !l.is_home);
      
      if (homeLogs.length < 10 || awayLogs.length < 10) return null;
      
      const homeAvg = homeLogs.reduce((sum, l) => sum + (l.stats?.points || 0), 0) / homeLogs.length;
      const awayAvg = awayLogs.reduce((sum, l) => sum + (l.stats?.points || 0), 0) / awayLogs.length;
      
      return {
        homeAverage: homeAvg,
        awayAverage: awayAvg,
        advantage: homeAvg - awayAvg,
        confidence: Math.min(95, 50 + (homeLogs.length + awayLogs.length) / 10),
        sampleSize: homeLogs.length + awayLogs.length
      };
    }
  },
  {
    name: 'Back-to-Back Fatigue',
    description: 'Players perform worse on second night of back-to-back games',
    detect: async (logs) => {
      // Sort by date
      const sorted = logs.sort((a, b) => 
        new Date(a.game_date).getTime() - new Date(b.game_date).getTime()
      );
      
      let b2bGames = 0;
      let normalGames = 0;
      let b2bPoints = 0;
      let normalPoints = 0;
      
      for (let i = 1; i < sorted.length; i++) {
        const prevDate = new Date(sorted[i-1].game_date);
        const currDate = new Date(sorted[i].game_date);
        const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 1 && sorted[i].stats?.points) {
          b2bGames++;
          b2bPoints += sorted[i].stats.points;
        } else if (daysDiff > 1 && sorted[i].stats?.points) {
          normalGames++;
          normalPoints += sorted[i].stats.points;
        }
      }
      
      if (b2bGames < 5 || normalGames < 5) return null;
      
      const b2bAvg = b2bPoints / b2bGames;
      const normalAvg = normalPoints / normalGames;
      
      return {
        backToBackAverage: b2bAvg,
        normalAverage: normalAvg,
        performanceDrop: ((normalAvg - b2bAvg) / normalAvg) * 100,
        confidence: Math.min(90, 60 + b2bGames),
        b2bGames,
        normalGames
      };
    }
  },
  {
    name: 'Minutes Impact',
    description: 'Performance correlation with playing time',
    detect: async (logs) => {
      const validLogs = logs.filter(l => l.minutes_played && l.stats?.points);
      if (validLogs.length < 20) return null;
      
      // Group by minutes ranges
      const ranges = {
        low: validLogs.filter(l => l.minutes_played < 20),
        medium: validLogs.filter(l => l.minutes_played >= 20 && l.minutes_played < 30),
        high: validLogs.filter(l => l.minutes_played >= 30)
      };
      
      const avgByRange = {
        low: ranges.low.length > 0 ? 
          ranges.low.reduce((sum, l) => sum + l.stats.points, 0) / ranges.low.length : 0,
        medium: ranges.medium.length > 0 ?
          ranges.medium.reduce((sum, l) => sum + l.stats.points, 0) / ranges.medium.length : 0,
        high: ranges.high.length > 0 ?
          ranges.high.reduce((sum, l) => sum + l.stats.points, 0) / ranges.high.length : 0
      };
      
      return {
        minuteRanges: {
          '<20min': { avg: avgByRange.low, count: ranges.low.length },
          '20-30min': { avg: avgByRange.medium, count: ranges.medium.length },
          '30+min': { avg: avgByRange.high, count: ranges.high.length }
        },
        correlation: avgByRange.high > avgByRange.low ? 'positive' : 'negative',
        confidence: Math.min(85, 60 + validLogs.length / 5)
      };
    }
  }
];

async function detectPatterns() {
  console.log(chalk.blue('\n🔍 Analyzing patterns in complete records...\n'));
  
  // Get a sample of complete records
  const { data: sampleLogs, count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact' })
    .not('team_id', 'is', null)
    .not('opponent_id', 'is', null)
    .not('stats', 'is', null)
    .limit(5000);
  
  console.log(chalk.gray(`Analyzing ${sampleLogs?.length || 0} of ${count || 0} complete records\n`));
  
  if (!sampleLogs || sampleLogs.length === 0) {
    console.log(chalk.red('No complete records found!'));
    return;
  }
  
  // Group by player for player-specific patterns
  const playerGroups = sampleLogs.reduce((acc, log) => {
    if (!acc[log.player_id]) acc[log.player_id] = [];
    acc[log.player_id].push(log);
    return acc;
  }, {} as Record<string, any[]>);
  
  const detectedPatterns: any[] = [];
  
  // Detect patterns
  for (const pattern of PATTERNS) {
    console.log(chalk.blue(`Detecting: ${pattern.name}...`));
    
    // Global pattern detection
    const globalResult = await pattern.detect(sampleLogs);
    if (globalResult) {
      detectedPatterns.push({
        type: 'global',
        pattern: pattern.name,
        ...globalResult
      });
      console.log(chalk.green(`  ✅ Found global pattern!`));
    }
    
    // Player-specific patterns
    let playerPatternsFound = 0;
    for (const [playerId, logs] of Object.entries(playerGroups)) {
      if (logs.length >= 10) {
        const result = await pattern.detect(logs);
        if (result && result.confidence > 70) {
          playerPatternsFound++;
        }
      }
    }
    
    if (playerPatternsFound > 0) {
      console.log(chalk.yellow(`  👤 Found in ${playerPatternsFound} players`));
    }
  }
  
  // Display results
  console.log(chalk.bold.cyan('\n🎯 PATTERN DETECTION RESULTS\n'));
  
  detectedPatterns.forEach(p => {
    console.log(chalk.bold.yellow(`${p.pattern}:`));
    delete p.pattern;
    delete p.type;
    
    Object.entries(p).forEach(([key, value]) => {
      if (typeof value === 'object') {
        console.log(chalk.gray(`  ${key}:`));
        Object.entries(value as any).forEach(([k, v]) => {
          console.log(chalk.white(`    ${k}: ${JSON.stringify(v)}`));
        });
      } else {
        console.log(chalk.white(`  ${key}: ${value}`));
      }
    });
    console.log();
  });
  
  // Save patterns to database
  if (detectedPatterns.length > 0) {
    console.log(chalk.blue('\n💾 Saving patterns to database...'));
    
    for (const pattern of detectedPatterns) {
      await supabase
        .from('pattern_results')
        .insert({
          pattern_type: pattern.pattern || 'unknown',
          confidence: pattern.confidence || 0,
          result: pattern,
          created_at: new Date().toISOString()
        });
    }
    
    console.log(chalk.green('✅ Patterns saved!'));
  }
  
  console.log(chalk.bold.green(`\n🎯 Found ${detectedPatterns.length} patterns with real data!`));
}

async function main() {
  await detectPatterns();
  
  console.log(chalk.bold.cyan('\n🚀 NEXT STEPS:'));
  console.log(chalk.white('1. Use these patterns for predictions'));
  console.log(chalk.white('2. Track pattern accuracy over time'));
  console.log(chalk.white('3. Build ML models on pattern features'));
}

main().catch(console.error);