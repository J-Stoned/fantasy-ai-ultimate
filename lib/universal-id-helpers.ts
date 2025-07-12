/**
 * Universal Game ID Helper Functions
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface GameData {
  sport: string
  start_time: string | Date
  home_team_abbreviation?: string
  away_team_abbreviation?: string
  home_team_id?: number
  away_team_id?: number
}

export interface ExternalIdMapping {
  game_id: number
  source: string
  external_id: string
}

/**
 * Generate a universal game ID
 * Format: {sport}_{YYYYMMDD}_{HHMM}_{home}_{away}
 */
export function generateUniversalGameId(game: GameData): string {
  const sport = (game.sport || 'unk').toLowerCase()
  
  // Parse date
  const date = new Date(game.start_time)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  
  // Parse time (UTC)
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}${minutes}`
  
  // Get team abbreviations
  const home = game.home_team_abbreviation?.toLowerCase() || 
               (game.home_team_id ? `t${game.home_team_id}` : 'tbd')
  const away = game.away_team_abbreviation?.toLowerCase() || 
               (game.away_team_id ? `t${game.away_team_id}` : 'tbd')
  
  return `${sport}_${dateStr}_${timeStr}_${home}_${away}`
}

/**
 * Find a game by its external ID
 */
export async function findGameByExternalId(source: string, externalId: string) {
  const { data: mapping } = await supabase
    .from('game_external_ids')
    .select('game_id')
    .eq('source', source)
    .eq('external_id', externalId)
    .single()
  
  if (!mapping) return null
  
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', mapping.game_id)
    .single()
  
  return game
}

/**
 * Find a game by its universal ID
 */
export async function findGameByUniversalId(universalId: string) {
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('universal_id', universalId)
    .single()
  
  return game
}

/**
 * Add an external ID mapping for a game
 */
export async function addExternalId(gameId: number, source: string, externalId: string) {
  const { error } = await supabase
    .from('game_external_ids')
    .upsert({
      game_id: gameId,
      source: source.toLowerCase(),
      external_id: externalId
    }, { 
      onConflict: 'game_id,source' 
    })
  
  if (error) {
    throw new Error(`Failed to add external ID: ${error.message}`)
  }
}

/**
 * Get all external IDs for a game
 */
export async function getGameExternalIds(gameId: number): Promise<ExternalIdMapping[]> {
  const { data } = await supabase
    .from('game_external_ids')
    .select('*')
    .eq('game_id', gameId)
  
  return data || []
}

/**
 * Create or update a game with universal ID
 */
export async function upsertGameWithUniversalId(gameData: any) {
  // Generate universal ID
  const universalId = generateUniversalGameId(gameData)
  
  // Check if game already exists
  const existingGame = await findGameByUniversalId(universalId)
  
  if (existingGame) {
    // Update existing game
    const { data: game, error } = await supabase
      .from('games')
      .update(gameData)
      .eq('id', existingGame.id)
      .select()
      .single()
    
    return { game, created: false }
  } else {
    // Create new game
    const { data: game, error } = await supabase
      .from('games')
      .insert({
        ...gameData,
        universal_id: universalId
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to create game: ${error.message}`)
    }
    
    return { game, created: true }
  }
}

/**
 * Parse external ID to determine source
 */
export function parseExternalIdSource(externalId: string): { source: string, cleanId: string } {
  // ESPN formats
  if (externalId.startsWith('espn_')) {
    return { source: 'espn', cleanId: externalId.replace('espn_', '').replace(/^[a-z]+_/, '') }
  }
  
  // Sport prefixes (assume ESPN)
  const sportPrefixes = ['nfl_', 'nba_', 'mlb_', 'nhl_', 'ncaaf_', 'ncaab_']
  for (const prefix of sportPrefixes) {
    if (externalId.startsWith(prefix)) {
      return { source: 'espn', cleanId: externalId.replace(prefix, '') }
    }
  }
  
  // Numeric only (assume ESPN)
  if (/^\d+$/.test(externalId)) {
    return { source: 'espn', cleanId: externalId }
  }
  
  // DraftKings format (future)
  if (externalId.startsWith('dk_')) {
    return { source: 'draftkings', cleanId: externalId.replace('dk_', '') }
  }
  
  // FanDuel format (future)
  if (externalId.startsWith('fd_')) {
    return { source: 'fanduel', cleanId: externalId.replace('fd_', '') }
  }
  
  return { source: 'unknown', cleanId: externalId }
}