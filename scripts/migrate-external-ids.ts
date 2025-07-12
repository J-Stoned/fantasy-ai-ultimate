#!/usr/bin/env tsx
/**
 * Migrate existing external IDs to game_external_ids mapping table
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExternalIdMapping {
  game_id: number
  source: string
  external_id: string
}

class ExternalIdMigrator {
  private stats = {
    totalGames: 0,
    processedGames: 0,
    migratedIds: 0,
    skippedGames: 0,
    errors: 0
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🔄 EXTERNAL ID MIGRATOR\n'))
    
    try {
      // Get all games with external IDs
      const games = await this.getGamesWithExternalIds()
      this.stats.totalGames = games.length
      
      console.log(chalk.green(`Found ${games.length} games with external IDs\n`))
      
      // Process in batches
      const batchSize = 500
      for (let i = 0; i < games.length; i += batchSize) {
        const batch = games.slice(i, i + batchSize)
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(games.length/batchSize)}...`))
        
        await this.processBatch(batch)
        
        console.log(chalk.cyan(`Progress: ${this.stats.processedGames}/${this.stats.totalGames} games`))
      }
      
      this.showReport()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
    }
  }
  
  private async getGamesWithExternalIds() {
    const games = []
    let hasMore = true
    let offset = 0
    const limit = 1000
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('games')
        .select('id, external_id, sport')
        .not('external_id', 'is', null)
        .range(offset, offset + limit - 1)
        .order('id')
      
      if (error) {
        console.error(chalk.red('Error fetching games:'), error)
        break
      }
      
      if (data) {
        games.push(...data)
        hasMore = data.length === limit
        offset += limit
      } else {
        hasMore = false
      }
    }
    
    return games
  }
  
  private async processBatch(games: any[]) {
    const mappings: ExternalIdMapping[] = []
    
    for (const game of games) {
      try {
        const parsed = this.parseExternalId(game.external_id, game.sport)
        
        if (parsed.source !== 'unknown') {
          mappings.push({
            game_id: game.id,
            source: parsed.source,
            external_id: parsed.cleanId
          })
          this.stats.migratedIds++
        } else {
          console.log(chalk.yellow(`Unknown format for game ${game.id}: ${game.external_id}`))
          this.stats.skippedGames++
        }
        
      } catch (error) {
        console.error(chalk.red(`Error processing game ${game.id}:`), error)
        this.stats.errors++
      }
      
      this.stats.processedGames++
    }
    
    // Insert mappings in batch
    if (mappings.length > 0) {
      const { error } = await supabase
        .from('game_external_ids')
        .insert(mappings)
        .select()
      
      if (error) {
        console.error(chalk.red('Error inserting mappings:'), error)
        this.stats.errors++
      }
    }
  }
  
  private parseExternalId(externalId: string, sport: string | null): { source: string, cleanId: string } {
    // Handle espn_ prefix
    if (externalId.startsWith('espn_')) {
      const cleanId = externalId.replace('espn_', '')
      
      // Remove any sport prefix from the clean ID
      const sportPrefixes = ['nfl_', 'nba_', 'mlb_', 'nhl_', 'ncaaf_', 'ncaab_']
      let finalId = cleanId
      for (const prefix of sportPrefixes) {
        if (cleanId.startsWith(prefix)) {
          finalId = cleanId.replace(prefix, '')
          break
        }
      }
      
      return { source: 'espn', cleanId: finalId }
    }
    
    // Handle sport_ prefix patterns
    const sportPatterns = [
      { pattern: /^nfl_(.+)/, source: 'espn' },
      { pattern: /^nba_(.+)/, source: 'espn' },
      { pattern: /^mlb_(.+)/, source: 'espn' },
      { pattern: /^nhl_(.+)/, source: 'espn' },
      { pattern: /^ncaaf_(.+)/, source: 'espn' },
      { pattern: /^ncaab_(.+)/, source: 'espn' }
    ]
    
    for (const { pattern, source } of sportPatterns) {
      const match = externalId.match(pattern)
      if (match) {
        return { source, cleanId: match[1] }
      }
    }
    
    // Handle numeric-only IDs (assume ESPN)
    if (/^\d+$/.test(externalId)) {
      return { source: 'espn', cleanId: externalId }
    }
    
    // Unknown format
    return { source: 'unknown', cleanId: externalId }
  }
  
  private showReport() {
    console.log(chalk.cyan.bold('\n📊 MIGRATION COMPLETE!\n'))
    console.log(chalk.white(`Total games with external IDs: ${this.stats.totalGames}`))
    console.log(chalk.green(`Successfully migrated: ${this.stats.migratedIds}`))
    console.log(chalk.yellow(`Skipped (unknown format): ${this.stats.skippedGames}`))
    console.log(chalk.red(`Errors: ${this.stats.errors}`))
    console.log(chalk.white(`Success rate: ${(this.stats.migratedIds / this.stats.totalGames * 100).toFixed(1)}%`))
    
    // Show source breakdown
    this.showSourceBreakdown()
  }
  
  private async showSourceBreakdown() {
    console.log(chalk.cyan('\n📈 Source Breakdown:'))
    
    const { data: sources } = await supabase
      .from('game_external_ids')
      .select('source')
    
    if (sources) {
      const counts = new Map<string, number>()
      sources.forEach(s => {
        counts.set(s.source, (counts.get(s.source) || 0) + 1)
      })
      
      counts.forEach((count, source) => {
        console.log(`  ${source}: ${count.toLocaleString()} games`)
      })
    }
  }
}

// Run migrator
async function main() {
  const migrator = new ExternalIdMigrator()
  await migrator.run()
}

if (require.main === module) {
  main().catch(console.error)
}