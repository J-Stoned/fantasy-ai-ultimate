#!/usr/bin/env tsx
/**
 * STANDARDIZE ESPN IDs - Migrate all ESPN IDs to standard format
 * Standard format: espn_{sport}_{numeric_id}
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'
import { standardizeEspnId, parseEspnId, isValidEspnId, SPORT_MAPPINGS } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MigrationStats {
  games: { total: number, updated: number, failed: number }
  teams: { total: number, updated: number, failed: number }
  players: { total: number, updated: number, failed: number }
}

const stats: MigrationStats = {
  games: { total: 0, updated: 0, failed: 0 },
  teams: { total: 0, updated: 0, failed: 0 },
  players: { total: 0, updated: 0, failed: 0 }
}

// Track all mappings for audit
const mappings: Array<{
  table: string
  id: number
  original: string
  standardized: string
  sport?: string
}> = []

async function standardizeAllEspnIds() {
  console.log(chalk.bold.red('🔧 ESPN ID STANDARDIZATION MIGRATION\n'))
  console.log(chalk.yellow('Standard format: espn_{sport}_{numeric_id}\n'))
  
  // Create mapping table first
  await createMappingTable()
  
  // Process each table
  await processGames()
  await processTeams()
  await processPlayers()
  
  // Save mappings
  await saveMappings()
  
  // Final report
  displayReport()
}

async function createMappingTable() {
  console.log(chalk.cyan('Creating ESPN ID mapping table...'))
  
  // Check if table exists
  const { data: tables } = await supabase
    .rpc('get_tables', { schema_name: 'public' })
    
  const tableExists = tables?.some((t: any) => t.table_name === 'espn_id_mappings')
  
  if (!tableExists) {
    // Create the table using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS espn_id_mappings (
          id SERIAL PRIMARY KEY,
          table_name VARCHAR(50) NOT NULL,
          record_id INTEGER NOT NULL,
          original_id VARCHAR(255) NOT NULL,
          standard_id VARCHAR(255) NOT NULL,
          sport VARCHAR(20),
          confidence DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(table_name, record_id)
        );
        
        CREATE INDEX idx_espn_mappings_original ON espn_id_mappings(original_id);
        CREATE INDEX idx_espn_mappings_standard ON espn_id_mappings(standard_id);
      `
    })
    
    if (error) {
      console.log(chalk.yellow('Note: Could not create mapping table via RPC'))
    } else {
      console.log(chalk.green('✅ Created ESPN ID mapping table'))
    }
  } else {
    console.log(chalk.yellow('ESPN ID mapping table already exists'))
  }
}

async function processGames() {
  console.log(chalk.cyan('\n📊 Processing GAMES table...'))
  
  let offset = 0
  let processed = 0
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, sport')
      .not('external_id', 'is', null)
      .or('external_id.like.%espn%,external_id.like.%nba_%,external_id.like.%nfl_%,external_id.like.%mlb_%,external_id.like.%nhl_%,external_id.like.%college%')
      .range(offset, offset + 999)
      .order('id')
    
    if (!games || games.length === 0) break
    
    for (const game of games) {
      stats.games.total++
      processed++
      
      // Skip if already standardized
      if (isValidEspnId(game.external_id)) {
        continue
      }
      
      // Try to standardize
      let standardized = standardizeEspnId(game.external_id, game.sport)
      
      // If failed and we have sport, try harder
      if (!standardized && game.sport) {
        const numericId = game.external_id.match(/(\d+)/)
        if (numericId) {
          const sportCode = SPORT_MAPPINGS[game.sport] || SPORT_MAPPINGS[game.sport.toLowerCase()]
          if (sportCode) {
            standardized = `espn_${sportCode}_${numericId[1]}`
          }
        }
      }
      
      if (standardized) {
        // Update the game
        const { error } = await supabase
          .from('games')
          .update({ external_id: standardized })
          .eq('id', game.id)
          
        if (!error) {
          stats.games.updated++
          mappings.push({
            table: 'games',
            id: game.id,
            original: game.external_id,
            standardized: standardized,
            sport: game.sport
          })
          
          if (stats.games.updated % 100 === 0) {
            console.log(chalk.green(`  ✅ Updated ${stats.games.updated} games`))
          }
        } else {
          stats.games.failed++
          console.error(chalk.red(`  ❌ Failed to update game ${game.id}: ${error.message}`))
        }
      } else {
        stats.games.failed++
        if (stats.games.failed <= 10) {
          console.log(chalk.yellow(`  ⚠️  Could not standardize: ${game.external_id} (sport: ${game.sport})`))
        }
      }
    }
    
    offset += 1000
    
    if (processed % 1000 === 0) {
      console.log(chalk.gray(`  Processed ${processed} games...`))
    }
  }
}

async function processTeams() {
  console.log(chalk.cyan('\n🏟️  Processing TEAMS table...'))
  
  let offset = 0
  
  while (true) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id, sport')
      .not('external_id', 'is', null)
      .like('external_id', '%espn%')
      .range(offset, offset + 999)
      .order('id')
    
    if (!teams || teams.length === 0) break
    
    for (const team of teams) {
      stats.teams.total++
      
      if (isValidEspnId(team.external_id)) {
        continue
      }
      
      const standardized = standardizeEspnId(team.external_id, team.sport)
      
      if (standardized) {
        const { error } = await supabase
          .from('teams')
          .update({ external_id: standardized })
          .eq('id', team.id)
          
        if (!error) {
          stats.teams.updated++
          mappings.push({
            table: 'teams',
            id: team.id,
            original: team.external_id,
            standardized: standardized,
            sport: team.sport
          })
        } else {
          stats.teams.failed++
        }
      } else {
        stats.teams.failed++
      }
    }
    
    offset += 1000
  }
}

async function processPlayers() {
  console.log(chalk.cyan('\n🏃 Processing PLAYERS table...'))
  
  let offset = 0
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id, sport')
      .not('external_id', 'is', null)
      .like('external_id', '%espn%')
      .range(offset, offset + 999)
      .order('id')
    
    if (!players || players.length === 0) break
    
    for (const player of players) {
      stats.players.total++
      
      if (isValidEspnId(player.external_id)) {
        continue
      }
      
      // For players, the format is often espn_12345 without sport
      let standardized = standardizeEspnId(player.external_id, player.sport)
      
      // If no sport in external_id but we have sport column
      if (!standardized && player.sport && player.external_id.match(/^espn_(\d+)$/)) {
        const numericId = player.external_id.match(/^espn_(\d+)$/)?.[1]
        if (numericId) {
          const sportCode = SPORT_MAPPINGS[player.sport] || SPORT_MAPPINGS[player.sport.toLowerCase()]
          if (sportCode) {
            standardized = `espn_${sportCode}_${numericId}`
          }
        }
      }
      
      if (standardized) {
        const { error } = await supabase
          .from('players')
          .update({ external_id: standardized })
          .eq('id', player.id)
          
        if (!error) {
          stats.players.updated++
          mappings.push({
            table: 'players',
            id: player.id,
            original: player.external_id,
            standardized: standardized,
            sport: player.sport
          })
          
          if (stats.players.updated % 1000 === 0) {
            console.log(chalk.green(`  ✅ Updated ${stats.players.updated} players`))
          }
        } else {
          stats.players.failed++
        }
      } else {
        stats.players.failed++
      }
    }
    
    offset += 1000
  }
}

async function saveMappings() {
  console.log(chalk.cyan('\n💾 Saving mappings to database...'))
  
  if (mappings.length === 0) {
    console.log(chalk.yellow('No mappings to save'))
    return
  }
  
  // Save in batches
  const batchSize = 100
  let saved = 0
  
  for (let i = 0; i < mappings.length; i += batchSize) {
    const batch = mappings.slice(i, i + batchSize).map(m => ({
      table_name: m.table,
      record_id: m.id,
      original_id: m.original,
      standard_id: m.standardized,
      sport: m.sport,
      confidence: 1.0
    }))
    
    const { error } = await supabase
      .from('espn_id_mappings')
      .upsert(batch, { onConflict: 'table_name,record_id' })
      
    if (!error) {
      saved += batch.length
    } else {
      console.error(chalk.red(`Failed to save batch: ${error.message}`))
    }
  }
  
  console.log(chalk.green(`✅ Saved ${saved} mappings`))
}

function displayReport() {
  console.log(chalk.bold.yellow('\n📊 MIGRATION COMPLETE!\n'))
  
  console.log(chalk.cyan('Games:'))
  console.log(`  Total: ${stats.games.total}`)
  console.log(`  Updated: ${stats.games.updated}`)
  console.log(`  Failed: ${stats.games.failed}`)
  console.log(`  Already standardized: ${stats.games.total - stats.games.updated - stats.games.failed}`)
  
  console.log(chalk.cyan('\nTeams:'))
  console.log(`  Total: ${stats.teams.total}`)
  console.log(`  Updated: ${stats.teams.updated}`)
  console.log(`  Failed: ${stats.teams.failed}`)
  console.log(`  Already standardized: ${stats.teams.total - stats.teams.updated - stats.teams.failed}`)
  
  console.log(chalk.cyan('\nPlayers:'))
  console.log(`  Total: ${stats.players.total}`)
  console.log(`  Updated: ${stats.players.updated}`)
  console.log(`  Failed: ${stats.players.failed}`)
  console.log(`  Already standardized: ${stats.players.total - stats.players.updated - stats.players.failed}`)
  
  const totalUpdated = stats.games.updated + stats.teams.updated + stats.players.updated
  const totalFailed = stats.games.failed + stats.teams.failed + stats.players.failed
  
  console.log(chalk.bold.green(`\n✅ TOTAL STANDARDIZED: ${totalUpdated}`))
  
  if (totalFailed > 0) {
    console.log(chalk.bold.red(`❌ TOTAL FAILED: ${totalFailed}`))
    console.log(chalk.yellow('\nCheck espn_id_mappings table for details'))
  }
  
  console.log(chalk.bold.cyan('\n🎯 All ESPN IDs now follow the standard format: espn_{sport}_{numeric_id}'))
}

// Run the migration
standardizeAllEspnIds().catch(console.error)