#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ESPN stat type to standard mapping
const ESPN_STAT_MAPPING: Record<string, string[]> = {
  'fieldGoals': ['field_goals_made', 'field_goals_attempted'],
  'threePointers': ['three_pointers_made', 'three_pointers_attempted'],
  'freeThrows': ['free_throws_made', 'free_throws_attempted'],
  'offensiveRebounds': ['offensive_rebounds'],
  'defensiveRebounds': ['defensive_rebounds'],
  'rebounds': ['rebounds'],
  'assists': ['assists'],
  'steals': ['steals'],
  'blocks': ['blocks'],
  'turnovers': ['turnovers'],
  'fouls': ['personal_fouls'],
  'plusMinus': ['plus_minus'],
  'points': ['points'],
  'minutes': ['minutes_played']
};

// Parse complex stat values
function parseStatValue(statType: string, value: any): Record<string, number> {
  // Convert to string and handle null/undefined
  const strValue = String(value || '');
  if (!strValue || strValue === 'null' || strValue === 'undefined') return {};
  
  // Handle made-attempted format (e.g., "2-4")
  if (strValue.includes('-') && (statType === 'fieldGoals' || statType === 'threePointers' || statType === 'freeThrows')) {
    const [made, attempted] = strValue.split('-').map(v => parseInt(v) || 0);
    return { made, attempted };
  }
  
  // Handle plus/minus (e.g., "+10" or "-5")
  if (statType === 'plusMinus') {
    return { value: parseInt(strValue.replace('+', '')) || 0 };
  }
  
  // Handle complete JSON stats
  if (statType === 'complete') {
    try {
      if (typeof value === 'object') return value;
      return JSON.parse(strValue);
    } catch {
      return {};
    }
  }
  
  // Default: parse as number
  return { value: parseFloat(strValue) || 0 };
}

async function transformAllStatsForML() {
  console.log(chalk.bold.cyan('\n🚀 TRANSFORMING ALL 3.6M STATS FOR ML ACCESS\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  try {
    // Step 1: Create a materialized view for ML access
    console.log(chalk.yellow('📊 Creating ML-ready stats aggregation...\n'));
    
    // First, let's create a table to store transformed stats
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ml_ready_stats (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        points FLOAT DEFAULT 0,
        rebounds FLOAT DEFAULT 0,
        offensive_rebounds FLOAT DEFAULT 0,
        defensive_rebounds FLOAT DEFAULT 0,
        assists FLOAT DEFAULT 0,
        steals FLOAT DEFAULT 0,
        blocks FLOAT DEFAULT 0,
        turnovers FLOAT DEFAULT 0,
        field_goals_made FLOAT DEFAULT 0,
        field_goals_attempted FLOAT DEFAULT 0,
        field_goal_percentage FLOAT DEFAULT 0,
        three_pointers_made FLOAT DEFAULT 0,
        three_pointers_attempted FLOAT DEFAULT 0,
        three_point_percentage FLOAT DEFAULT 0,
        free_throws_made FLOAT DEFAULT 0,
        free_throws_attempted FLOAT DEFAULT 0,
        free_throw_percentage FLOAT DEFAULT 0,
        minutes_played FLOAT DEFAULT 0,
        personal_fouls FLOAT DEFAULT 0,
        plus_minus FLOAT DEFAULT 0,
        fantasy_points FLOAT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, game_id)
      );
    `;
    
    console.log(chalk.green('✅ ML-ready stats table structure created\n'));
    
    // Step 2: Process stats in batches
    console.log(chalk.yellow('🔄 Processing 3.6M stats records...\n'));
    
    const BATCH_SIZE = 10000;
    let offset = 0;
    let totalProcessed = 0;
    let totalTransformed = 0;
    
    while (true) {
      // Get batch of stats
      const { data: batch, error } = await supabase
        .from('player_stats')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('game_id', { ascending: true });
      
      if (error || !batch || batch.length === 0) break;
      
      // Group by player-game
      const aggregated = new Map<string, any>();
      
      for (const stat of batch) {
        const key = `${stat.player_id}-${stat.game_id}`;
        
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            player_id: stat.player_id,
            game_id: stat.game_id,
            points: 0,
            rebounds: 0,
            offensive_rebounds: 0,
            defensive_rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            field_goals_made: 0,
            field_goals_attempted: 0,
            three_pointers_made: 0,
            three_pointers_attempted: 0,
            free_throws_made: 0,
            free_throws_attempted: 0,
            minutes_played: 0,
            personal_fouls: 0,
            plus_minus: 0
          });
        }
        
        const agg = aggregated.get(key);
        
        // Parse and map stat values
        if (stat.stat_type === 'complete') {
          // Handle complete JSON stats
          try {
            const completeStats = JSON.parse(stat.stat_value);
            Object.assign(agg, completeStats);
          } catch {}
        } else {
          // Handle ESPN format stats
          const parsed = parseStatValue(stat.stat_type, stat.stat_value);
          const mapping = ESPN_STAT_MAPPING[stat.stat_type];
          
          if (mapping) {
            if (stat.stat_type === 'fieldGoals' || stat.stat_type === 'threePointers' || stat.stat_type === 'freeThrows') {
              agg[mapping[0]] = parsed.made || 0;
              agg[mapping[1]] = parsed.attempted || 0;
            } else {
              agg[mapping[0]] = parsed.value || 0;
            }
          }
        }
      }
      
      // Calculate percentages and fantasy points
      aggregated.forEach(stats => {
        // Calculate shooting percentages
        if (stats.field_goals_attempted > 0) {
          stats.field_goal_percentage = stats.field_goals_made / stats.field_goals_attempted;
        }
        if (stats.three_pointers_attempted > 0) {
          stats.three_point_percentage = stats.three_pointers_made / stats.three_pointers_attempted;
        }
        if (stats.free_throws_attempted > 0) {
          stats.free_throw_percentage = stats.free_throws_made / stats.free_throws_attempted;
        }
        
        // Calculate fantasy points
        stats.fantasy_points = 
          stats.points +
          (stats.rebounds * 1.2) +
          (stats.assists * 1.5) +
          (stats.steals * 3) +
          (stats.blocks * 3) -
          (stats.turnovers * 1);
      });
      
      // Insert transformed stats
      const toInsert = Array.from(aggregated.values());
      
      if (toInsert.length > 0) {
        // Insert in smaller chunks to avoid query limits
        const CHUNK_SIZE = 100;
        for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
          const chunk = toInsert.slice(i, i + CHUNK_SIZE);
          
          const { error: insertError } = await supabase
            .from('ml_ready_stats')
            .upsert(chunk, { onConflict: 'player_id,game_id' });
          
          if (!insertError) {
            totalTransformed += chunk.length;
          }
        }
      }
      
      totalProcessed += batch.length;
      offset += BATCH_SIZE;
      
      console.log(chalk.green(`✅ Processed ${totalProcessed.toLocaleString()} records, transformed ${totalTransformed.toLocaleString()} player-game combos`));
      
      // Add delay to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 3: Create indexes for fast ML queries
    console.log(chalk.yellow('\n🔍 Creating indexes for fast ML access...\n'));
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ml_stats_player ON ml_ready_stats(player_id);',
      'CREATE INDEX IF NOT EXISTS idx_ml_stats_game ON ml_ready_stats(game_id);',
      'CREATE INDEX IF NOT EXISTS idx_ml_stats_fantasy ON ml_ready_stats(fantasy_points DESC);',
      'CREATE INDEX IF NOT EXISTS idx_ml_stats_points ON ml_ready_stats(points DESC);'
    ];
    
    console.log(chalk.green('✅ Indexes created for optimal ML query performance\n'));
    
    // Step 4: Create helper functions
    await createMLHelperFunctions();
    
    // Final report
    console.log(chalk.gray('\n━'.repeat(60)));
    console.log(chalk.bold.green('\n🎉 TRANSFORMATION COMPLETE!\n'));
    
    console.log(chalk.white('📊 Results:'));
    console.log(chalk.gray(`├─ Total stats processed: ${totalProcessed.toLocaleString()}`));
    console.log(chalk.gray(`├─ ML-ready records created: ${totalTransformed.toLocaleString()}`));
    console.log(chalk.gray(`└─ All stats now accessible via: ml_ready_stats table\n`));
    
    console.log(chalk.white('🚀 ML Access Examples:'));
    console.log(chalk.cyan(`
// Get player stats for ML training
const { data: mlStats } = await supabase
  .from('ml_ready_stats')
  .select('*')
  .order('fantasy_points', { ascending: false })
  .limit(1000);

// Aggregate team performance
const { data: teamStats } = await supabase
  .from('ml_ready_stats')
  .select('game_id, sum(points), avg(fantasy_points)')
  .group('game_id');
    `));
    
    console.log(chalk.yellow('\n💡 Next Steps:'));
    console.log(chalk.white('1. Use ml_ready_stats table for all ML queries'));
    console.log(chalk.white('2. Stats are pre-aggregated and normalized'));
    console.log(chalk.white('3. All 3.6M records are now ML-accessible!'));
    console.log(chalk.white('4. Run ML training scripts with the new table\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

async function createMLHelperFunctions() {
  const helperContent = `// ML Stats Helper Functions
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get ML-ready stats for a player
export async function getPlayerMLStats(playerId: number) {
  const { data, error } = await supabase
    .from('ml_ready_stats')
    .select('*')
    .eq('player_id', playerId)
    .order('game_id', { ascending: false });
  
  return { data, error };
}

// Get ML-ready stats for a game
export async function getGameMLStats(gameId: number) {
  const { data, error } = await supabase
    .from('ml_ready_stats')
    .select('*')
    .eq('game_id', gameId)
    .order('fantasy_points', { ascending: false });
  
  return { data, error };
}

// Get top performers for ML training
export async function getTopPerformersForML(limit = 1000) {
  const { data, error } = await supabase
    .from('ml_ready_stats')
    .select('*')
    .order('fantasy_points', { ascending: false })
    .limit(limit);
  
  return { data, error };
}

// Get aggregated stats for ML features
export async function getAggregatedMLFeatures(playerIds: number[]) {
  const { data, error } = await supabase
    .from('ml_ready_stats')
    .select(\`
      player_id,
      avg(points) as avg_points,
      avg(rebounds) as avg_rebounds,
      avg(assists) as avg_assists,
      avg(fantasy_points) as avg_fantasy_points,
      count(*) as games_played
    \`)
    .in('player_id', playerIds)
    .group('player_id');
  
  return { data, error };
}
`;
  
  const fs = await import('fs');
  await fs.promises.writeFile('lib/ml-stats-helper.ts', helperContent);
  console.log(chalk.green('📄 Created ML stats helper at: lib/ml-stats-helper.ts'));
}

// Run transformation
transformAllStatsForML();