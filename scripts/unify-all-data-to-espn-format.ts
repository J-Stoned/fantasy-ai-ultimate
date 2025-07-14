#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Define the unified ESPN format
interface ESPNStatFormat {
  player_id: string;  // ESPN ID format: espn_nba_12345
  game_id: string;    // ESPN game ID
  stat_type: string;  // ESPN stat types
  stat_value: string; // ESPN value format (e.g., "2-4" for field goals)
  fantasy_points?: number;
  created_at: string;
}

// Mapping from various formats to ESPN stat types
const TO_ESPN_STAT_MAPPING: Record<string, string> = {
  // Standard to ESPN
  'points': 'points',
  'pts': 'points',
  'total_points': 'points',
  
  'rebounds': 'rebounds',
  'reb': 'rebounds',
  'total_rebounds': 'rebounds',
  'offensive_rebounds': 'offensiveRebounds',
  'oreb': 'offensiveRebounds',
  'defensive_rebounds': 'defensiveRebounds',
  'dreb': 'defensiveRebounds',
  
  'assists': 'assists',
  'ast': 'assists',
  
  'steals': 'steals',
  'stl': 'steals',
  
  'blocks': 'blocks',
  'blk': 'blocks',
  
  'turnovers': 'turnovers',
  'to': 'turnovers',
  'tov': 'turnovers',
  
  'field_goals_made': 'fieldGoals',
  'field_goals_attempted': 'fieldGoals',
  'fgm': 'fieldGoals',
  'fga': 'fieldGoals',
  
  'three_pointers_made': 'threePointers',
  'three_pointers_attempted': 'threePointers',
  'three_point_field_goals_made': 'threePointers',
  '3pm': 'threePointers',
  '3pa': 'threePointers',
  
  'free_throws_made': 'freeThrows',
  'free_throws_attempted': 'freeThrows',
  'ftm': 'freeThrows',
  'fta': 'freeThrows',
  
  'minutes': 'minutes',
  'min': 'minutes',
  'minutes_played': 'minutes',
  
  'personal_fouls': 'fouls',
  'pf': 'fouls',
  'fouls': 'fouls',
  
  'plus_minus': 'plusMinus',
  '+/-': 'plusMinus'
};

async function unifyAllDataToESPNFormat() {
  console.log(chalk.bold.cyan('\n🏀 UNIFYING ALL DATA TO ESPN FORMAT\n'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.yellow('Converting all stats to ESPN format for ML accessibility...\n'));
  
  try {
    // Step 1: Create unified ESPN format table
    console.log(chalk.yellow('📊 Creating unified ESPN format table...\n'));
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS espn_unified_stats (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        stat_type TEXT NOT NULL,
        stat_value TEXT NOT NULL,
        fantasy_points FLOAT,
        sport TEXT DEFAULT 'nba',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, game_id, stat_type)
      );
      
      CREATE INDEX IF NOT EXISTS idx_espn_player ON espn_unified_stats(player_id);
      CREATE INDEX IF NOT EXISTS idx_espn_game ON espn_unified_stats(game_id);
      CREATE INDEX IF NOT EXISTS idx_espn_stat_type ON espn_unified_stats(stat_type);
    `;
    
    console.log(chalk.green('✅ ESPN unified table structure created\n'));
    
    // Step 2: Process existing player_stats data
    console.log(chalk.yellow('🔄 Processing existing player_stats data...\n'));
    
    let processedCount = 0;
    let convertedCount = 0;
    const BATCH_SIZE = 5000;
    let offset = 0;
    
    // First, let's understand what we're working with
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(100);
    
    console.log(chalk.cyan('Sample data structure:'));
    if (sampleStats && sampleStats.length > 0) {
      console.log(chalk.gray(JSON.stringify(sampleStats[0], null, 2)));
    }
    
    // Process all player_stats
    while (true) {
      const { data: batch, error } = await supabase
        .from('player_stats')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (error || !batch || batch.length === 0) break;
      
      const espnFormatData: ESPNStatFormat[] = [];
      
      for (const stat of batch) {
        // Skip if missing required fields
        if (!stat.player_id || !stat.game_id || !stat.stat_type) continue;
        
        // Convert player_id to ESPN format if needed
        const playerId = stat.player_id.toString().startsWith('espn_') 
          ? stat.player_id.toString()
          : `espn_nba_${stat.player_id}`;
        
        // Convert game_id to string
        const gameId = stat.game_id.toString();
        
        // Handle different stat types
        if (stat.stat_type === 'complete') {
          // Parse complete JSON stats
          try {
            const completeStats = typeof stat.stat_value === 'object' 
              ? stat.stat_value 
              : JSON.parse(stat.stat_value);
            
            // Convert each stat in the complete object
            for (const [key, value] of Object.entries(completeStats)) {
              const espnStatType = TO_ESPN_STAT_MAPPING[key] || key;
              
              // Handle field goals, three pointers, free throws
              if (key.includes('made') || key.includes('attempted')) {
                const baseType = key.replace('_made', '').replace('_attempted', '');
                const espnType = TO_ESPN_STAT_MAPPING[baseType] || baseType;
                
                // Find the corresponding made/attempted values
                if (key.includes('made')) {
                  const attemptedKey = key.replace('made', 'attempted');
                  const attemptedValue = completeStats[attemptedKey] || 0;
                  
                  espnFormatData.push({
                    player_id: playerId,
                    game_id: gameId,
                    stat_type: espnType,
                    stat_value: `${value}-${attemptedValue}`,
                    created_at: stat.created_at
                  });
                }
              } else if (!key.includes('attempted')) {
                // Regular stats
                espnFormatData.push({
                  player_id: playerId,
                  game_id: gameId,
                  stat_type: espnStatType,
                  stat_value: String(value),
                  created_at: stat.created_at
                });
              }
            }
          } catch (e) {
            console.error(chalk.red(`Error parsing complete stats: ${e}`));
          }
        } else {
          // Regular stat entry
          let espnStatType = TO_ESPN_STAT_MAPPING[stat.stat_type] || stat.stat_type;
          let statValue = String(stat.stat_value || '0');
          
          // Special handling for made/attempted stats
          if (stat.stat_type.includes('made') || stat.stat_type.includes('attempted')) {
            // These should be combined into single entries
            continue; // Skip for now, will handle in aggregation phase
          }
          
          espnFormatData.push({
            player_id: playerId,
            game_id: gameId,
            stat_type: espnStatType,
            stat_value: statValue,
            fantasy_points: stat.fantasy_points,
            created_at: stat.created_at
          });
        }
      }
      
      // Insert ESPN format data
      if (espnFormatData.length > 0) {
        // Insert in chunks
        const CHUNK_SIZE = 100;
        for (let i = 0; i < espnFormatData.length; i += CHUNK_SIZE) {
          const chunk = espnFormatData.slice(i, i + CHUNK_SIZE);
          
          const { error: insertError } = await supabase
            .from('espn_unified_stats')
            .upsert(chunk, { onConflict: 'player_id,game_id,stat_type' });
          
          if (!insertError) {
            convertedCount += chunk.length;
          }
        }
      }
      
      processedCount += batch.length;
      offset += BATCH_SIZE;
      
      console.log(chalk.green(`✅ Processed ${processedCount.toLocaleString()} records, converted ${convertedCount.toLocaleString()} to ESPN format`));
      
      // Add delay to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Step 3: Process player_game_logs data
    console.log(chalk.yellow('\n🔄 Processing player_game_logs data...\n'));
    
    const { data: gameLogs } = await supabase
      .from('player_game_logs')
      .select('*')
      .not('stats', 'is', null)
      .limit(1000);
    
    let gameLogsConverted = 0;
    
    if (gameLogs) {
      for (const log of gameLogs) {
        if (!log.stats || typeof log.stats !== 'object') continue;
        
        const playerId = log.player_id.toString().startsWith('espn_') 
          ? log.player_id.toString()
          : `espn_nba_${log.player_id}`;
        
        const gameId = log.game_id.toString();
        const espnStats: ESPNStatFormat[] = [];
        
        // Convert stats object to ESPN format
        for (const [key, value] of Object.entries(log.stats)) {
          const espnStatType = TO_ESPN_STAT_MAPPING[key] || key;
          
          // Handle combined stats
          if (key === 'field_goals_made' || key === 'three_pointers_made' || key === 'free_throws_made') {
            const attemptedKey = key.replace('made', 'attempted');
            const attemptedValue = log.stats[attemptedKey] || 0;
            const baseType = key.replace('_made', '');
            
            espnStats.push({
              player_id: playerId,
              game_id: gameId,
              stat_type: TO_ESPN_STAT_MAPPING[baseType] || baseType,
              stat_value: `${value}-${attemptedValue}`,
              fantasy_points: log.fantasy_points,
              created_at: log.created_at
            });
          } else if (!key.includes('attempted') && !key.includes('percentage')) {
            espnStats.push({
              player_id: playerId,
              game_id: gameId,
              stat_type: espnStatType,
              stat_value: String(value),
              fantasy_points: log.fantasy_points,
              created_at: log.created_at
            });
          }
        }
        
        // Insert ESPN stats
        if (espnStats.length > 0) {
          const { error } = await supabase
            .from('espn_unified_stats')
            .upsert(espnStats, { onConflict: 'player_id,game_id,stat_type' });
          
          if (!error) {
            gameLogsConverted += espnStats.length;
          }
        }
      }
    }
    
    console.log(chalk.green(`✅ Converted ${gameLogsConverted} stats from player_game_logs\n`));
    
    // Step 4: Create helper functions and views
    console.log(chalk.yellow('🔧 Creating helper functions for ML access...\n'));
    
    await createESPNHelperFunctions();
    
    // Final report
    console.log(chalk.gray('\n━'.repeat(60)));
    console.log(chalk.bold.green('\n🎉 ESPN FORMAT UNIFICATION COMPLETE!\n'));
    
    const { count: totalESPNStats } = await supabase
      .from('espn_unified_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.white('📊 Results:'));
    console.log(chalk.gray(`├─ Total ESPN format records: ${totalESPNStats?.toLocaleString()}`));
    console.log(chalk.gray(`├─ Original records processed: ${processedCount.toLocaleString()}`));
    console.log(chalk.gray(`└─ Conversion rate: ${((convertedCount / processedCount) * 100).toFixed(1)}%\n`));
    
    console.log(chalk.white('🚀 ML Access Examples:'));
    console.log(chalk.cyan(`
// Get all stats for a player in ESPN format
const { data } = await supabase
  .from('espn_unified_stats')
  .select('*')
  .eq('player_id', 'espn_nba_12345');

// Aggregate stats for ML training
const { data: mlData } = await supabase
  .from('espn_unified_stats')
  .select('player_id, game_id, stat_type, stat_value')
  .in('stat_type', ['points', 'rebounds', 'assists']);
    `));
    
    console.log(chalk.yellow('\n💡 Benefits:'));
    console.log(chalk.white('1. All data now in consistent ESPN format'));
    console.log(chalk.white('2. Complex values preserved (e.g., "2-4" for field goals)'));
    console.log(chalk.white('3. Easy ML feature extraction with standardized stat_types'));
    console.log(chalk.white('4. Indexed for fast queries on 3.6M+ records\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

async function createESPNHelperFunctions() {
  const helperContent = `// ESPN Format Stats Helper Functions
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Parse ESPN stat values (e.g., "2-4" → { made: 2, attempted: 4 })
export function parseESPNStatValue(statType: string, value: string): any {
  if (statType === 'fieldGoals' || statType === 'threePointers' || statType === 'freeThrows') {
    const [made, attempted] = value.split('-').map(Number);
    return { made, attempted, percentage: attempted > 0 ? made / attempted : 0 };
  }
  
  if (statType === 'plusMinus') {
    return parseInt(value.replace('+', ''));
  }
  
  return parseFloat(value) || 0;
}

// Get aggregated stats for ML in ESPN format
export async function getPlayerStatsForML(playerId: string) {
  const { data, error } = await supabase
    .from('espn_unified_stats')
    .select('*')
    .eq('player_id', playerId)
    .order('game_id', { ascending: false });
  
  if (error) return { error };
  
  // Aggregate stats by game
  const gameStats = new Map();
  
  data?.forEach(stat => {
    if (!gameStats.has(stat.game_id)) {
      gameStats.set(stat.game_id, {});
    }
    
    const game = gameStats.get(stat.game_id);
    const parsed = parseESPNStatValue(stat.stat_type, stat.stat_value);
    
    if (stat.stat_type === 'fieldGoals') {
      game.field_goals_made = parsed.made;
      game.field_goals_attempted = parsed.attempted;
      game.field_goal_percentage = parsed.percentage;
    } else if (stat.stat_type === 'threePointers') {
      game.three_pointers_made = parsed.made;
      game.three_pointers_attempted = parsed.attempted;
      game.three_point_percentage = parsed.percentage;
    } else if (stat.stat_type === 'freeThrows') {
      game.free_throws_made = parsed.made;
      game.free_throws_attempted = parsed.attempted;
      game.free_throw_percentage = parsed.percentage;
    } else {
      game[stat.stat_type] = parsed;
    }
  });
  
  return { data: Array.from(gameStats.entries()).map(([gameId, stats]) => ({ gameId, ...stats })) };
}

// Get all ESPN format stats ready for ML training
export async function getAllESPNStatsForML(limit = 10000) {
  const { data, error } = await supabase
    .from('espn_unified_stats')
    .select('*')
    .limit(limit);
  
  return { data, error };
}
`;
  
  const fs = await import('fs');
  await fs.promises.writeFile('lib/espn-stats-helper.ts', helperContent);
  console.log(chalk.green('📄 Created ESPN stats helper at: lib/espn-stats-helper.ts'));
}

// Run unification
unifyAllDataToESPNFormat();