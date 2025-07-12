#!/usr/bin/env tsx
/**
 * Generate Universal IDs for all games
 * Format: {sport}_{YYYYMMDD}_{HHMM}_{home}_{away}
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import * as fs from 'fs'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Game {
  id: number
  sport: string | null
  start_time: string
  home_team_id: number | null
  away_team_id: number | null
  external_id: string | null
}

interface Team {
  id: number
  name: string
  abbreviation: string | null
}

class UniversalIdGenerator {
  private teamCache = new Map<number, string>()
  private stats = {
    totalGames: 0,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    duplicates: 0,
    conflicts: 0
  }
  private universalIds = new Map<string, number[]>()
  
  async run() {
    console.log(chalk.cyan.bold('\n🆔 UNIVERSAL ID GENERATOR\n'))
    
    try {
      // Load team abbreviations
      await this.loadTeamAbbreviations()
      
      // Get all games
      const games = await this.getAllGames()
      this.stats.totalGames = games.length
      
      console.log(chalk.green(`Found ${games.length} games to process\n`))
      
      // Process in batches
      const batchSize = 1000
      for (let i = 0; i < games.length; i += batchSize) {
        const batch = games.slice(i, i + batchSize)
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(games.length/batchSize)}...`))
        
        await this.processBatch(batch)
        
        // Show progress
        console.log(chalk.cyan(`Progress: ${this.stats.processedGames}/${this.stats.totalGames} games`))
      }
      
      // Handle conflicts (games with same universal ID)
      await this.resolveConflicts()
      
      // Show final report
      this.showReport()
      
      // Save mapping for verification
      await this.saveMapping()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
    }
  }
  
  private async loadTeamAbbreviations() {
    console.log(chalk.yellow('Loading team abbreviations...'))
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
    
    if (!teams) return
    
    teams.forEach(team => {
      // Use abbreviation if available, otherwise generate from name
      const abbr = team.abbreviation || this.generateAbbreviation(team.name)
      this.teamCache.set(team.id, abbr.toLowerCase())
    })
    
    console.log(chalk.green(`Loaded ${this.teamCache.size} team abbreviations\n`))
  }
  
  private generateAbbreviation(name: string): string {
    // Simple abbreviation generation
    const words = name.split(' ')
    
    // Handle common patterns
    if (words.length >= 2) {
      // "New York Yankees" -> "NYY"
      // "Los Angeles Lakers" -> "LAL"
      if (words[0] === 'New' && words[1] === 'York') {
        return 'NY' + words[2].charAt(0)
      }
      if (words[0] === 'Los' && words[1] === 'Angeles') {
        return 'LA' + words[2].charAt(0)
      }
      if (words[0] === 'San') {
        return 'S' + words[1].charAt(0) + (words[2] ? words[2].charAt(0) : '')
      }
    }
    
    // Default: first 3 letters of last word
    const lastWord = words[words.length - 1]
    return lastWord.substring(0, 3).toUpperCase()
  }
  
  private async getAllGames(): Promise<Game[]> {
    const games: Game[] = []
    let hasMore = true
    let offset = 0
    const limit = 1000
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('games')
        .select('id, sport, start_time, home_team_id, away_team_id, external_id')
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
  
  private async processBatch(games: Game[]) {
    const updates = []
    
    for (const game of games) {
      try {
        const universalId = this.generateUniversalId(game)
        
        // Track potential conflicts
        if (!this.universalIds.has(universalId)) {
          this.universalIds.set(universalId, [])
        }
        this.universalIds.get(universalId)!.push(game.id)
        
        updates.push({
          id: game.id,
          universal_id: universalId
        })
        
        this.stats.successfulGames++
      } catch (error) {
        console.error(chalk.red(`Failed to generate ID for game ${game.id}:`), error)
        this.stats.failedGames++
      }
      
      this.stats.processedGames++
    }
    
    // Batch update games
    if (updates.length > 0) {
      const { error } = await supabase
        .from('games')
        .upsert(updates, { onConflict: 'id' })
      
      if (error) {
        console.error(chalk.red('Error updating games:'), error)
      }
    }
  }
  
  private generateUniversalId(game: Game): string {
    // Sport (lowercase, default to 'unk')
    const sport = (game.sport || 'unk').toLowerCase()
    
    // Date (YYYYMMDD)
    const date = new Date(game.start_time)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    
    // Time (HHMM in UTC)
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    const timeStr = `${hours}${minutes}`
    
    // Teams
    const home = this.getTeamAbbreviation(game.home_team_id)
    const away = this.getTeamAbbreviation(game.away_team_id)
    
    return `${sport}_${dateStr}_${timeStr}_${home}_${away}`
  }
  
  private getTeamAbbreviation(teamId: number | null): string {
    if (!teamId) return 'tbd'
    
    const abbr = this.teamCache.get(teamId)
    if (abbr) return abbr
    
    // Fallback: use team ID
    return `t${teamId}`
  }
  
  private async resolveConflicts() {
    console.log(chalk.yellow('\nResolving conflicts...'))
    
    const conflictUpdates = []
    
    this.universalIds.forEach((gameIds, universalId) => {
      if (gameIds.length > 1) {
        this.stats.conflicts++
        console.log(chalk.red(`Conflict found: ${universalId} used by games ${gameIds.join(', ')}`))
        
        // Add sequence numbers to resolve conflicts
        gameIds.forEach((gameId, index) => {
          if (index > 0) {
            const sequencedId = `${universalId}_${(index + 1).toString().padStart(2, '0')}`
            conflictUpdates.push({
              id: gameId,
              universal_id: sequencedId
            })
          }
        })
      }
    })
    
    // Update conflicting games
    if (conflictUpdates.length > 0) {
      const { error } = await supabase
        .from('games')
        .upsert(conflictUpdates, { onConflict: 'id' })
      
      if (error) {
        console.error(chalk.red('Error resolving conflicts:'), error)
      } else {
        console.log(chalk.green(`Resolved ${this.stats.conflicts} conflicts`))
      }
    }
  }
  
  private showReport() {
    console.log(chalk.cyan.bold('\n📊 GENERATION COMPLETE!\n'))
    console.log(chalk.white(`Total games: ${this.stats.totalGames}`))
    console.log(chalk.green(`Successfully processed: ${this.stats.successfulGames}`))
    console.log(chalk.red(`Failed: ${this.stats.failedGames}`))
    console.log(chalk.yellow(`Conflicts resolved: ${this.stats.conflicts}`))
    console.log(chalk.white(`Success rate: ${(this.stats.successfulGames / this.stats.totalGames * 100).toFixed(1)}%`))
  }
  
  private async saveMapping() {
    // Save a sample of the mapping for verification
    const { data: sample } = await supabase
      .from('games')
      .select('id, universal_id, external_id, sport, start_time')
      .not('universal_id', 'is', null)
      .limit(100)
    
    if (sample) {
      const mapping = {
        generated_at: new Date().toISOString(),
        stats: this.stats,
        sample: sample
      }
      
      fs.writeFileSync('universal-id-mapping-sample.json', JSON.stringify(mapping, null, 2))
      console.log(chalk.green('\nSaved mapping sample to universal-id-mapping-sample.json'))
    }
  }
}

// Run generator
async function main() {
  const generator = new UniversalIdGenerator()
  await generator.run()
}

if (require.main === module) {
  main().catch(console.error)
}