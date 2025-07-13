/**
 * ESPN ID Standardization Utilities
 * 
 * Standard format: espn_{sport}_{numeric_id}
 * Sport codes: nba, nfl, mlb, nhl, ncaab, ncaaf (always lowercase)
 */

// Valid sport codes (lowercase)
export const VALID_SPORT_CODES = ['nba', 'nfl', 'mlb', 'nhl', 'ncaab', 'ncaaf', 'mls'] as const
export type SportCode = typeof VALID_SPORT_CODES[number]

// Sport name mappings to standard codes
export const SPORT_MAPPINGS: Record<string, SportCode> = {
  // Direct mappings
  'nba': 'nba',
  'nfl': 'nfl',
  'mlb': 'mlb',
  'nhl': 'nhl',
  'ncaab': 'ncaab',
  'ncaaf': 'ncaaf',
  'mls': 'mls',
  
  // Uppercase variations
  'NBA': 'nba',
  'NFL': 'nfl',
  'MLB': 'mlb',
  'NHL': 'nhl',
  'NCAAB': 'ncaab',
  'NCAAF': 'ncaaf',
  'MLS': 'mls',
  
  // Alternative names
  'basketball': 'nba',
  'football': 'nfl',
  'baseball': 'mlb',
  'hockey': 'nhl',
  'college-basketball': 'ncaab',
  'college-football': 'ncaaf',
  'mens-college-basketball': 'ncaab',
  'soccer': 'mls',
  
  // Database variations
  'NCAA_BB': 'ncaab',
  'NCAA_FB': 'ncaaf',
  'ncaa_bb': 'ncaab',
  'ncaa_fb': 'ncaaf'
}

// ESPN API endpoint mappings
export const ESPN_API_ENDPOINTS: Record<SportCode, string> = {
  'nba': 'basketball/nba',
  'nfl': 'football/nfl',
  'mlb': 'baseball/mlb',
  'nhl': 'hockey/nhl',
  'ncaab': 'basketball/mens-college-basketball',
  'ncaaf': 'football/college-football',
  'mls': 'soccer/usa.1'
}

/**
 * Validates if a string is a properly formatted ESPN ID
 */
export function isValidEspnId(id: string): boolean {
  const pattern = /^espn_([a-z]+)_(\d+)$/
  const match = id.match(pattern)
  
  if (!match) return false
  
  const sport = match[1] as SportCode
  return VALID_SPORT_CODES.includes(sport)
}

/**
 * Extracts components from an ESPN ID
 */
export function parseEspnId(id: string): { sport: SportCode; numericId: string } | null {
  // Try standard format first
  const standardMatch = id.match(/^espn_([a-z]+)_(\d+)$/)
  if (standardMatch && VALID_SPORT_CODES.includes(standardMatch[1] as SportCode)) {
    return {
      sport: standardMatch[1] as SportCode,
      numericId: standardMatch[2]
    }
  }
  
  // Try legacy format: sport_id
  const legacyMatch = id.match(/^([a-zA-Z_-]+)_(\d+)$/)
  if (legacyMatch) {
    const sport = SPORT_MAPPINGS[legacyMatch[1]] || SPORT_MAPPINGS[legacyMatch[1].toLowerCase()]
    if (sport) {
      return {
        sport,
        numericId: legacyMatch[2]
      }
    }
  }
  
  // Try format without sport: espn_id
  const noSportMatch = id.match(/^espn_(\d+)$/)
  if (noSportMatch) {
    return null // Can't determine sport
  }
  
  // Try pure numeric
  const numericMatch = id.match(/^(\d+)$/)
  if (numericMatch) {
    return null // Can't determine sport
  }
  
  return null
}

/**
 * Generates a standardized ESPN ID
 */
export function generateEspnId(sport: string, numericId: string | number): string {
  const sportCode = SPORT_MAPPINGS[sport] || SPORT_MAPPINGS[sport.toLowerCase()]
  
  if (!sportCode) {
    throw new Error(`Invalid sport: ${sport}`)
  }
  
  return `espn_${sportCode}_${numericId}`
}

/**
 * Attempts to standardize any ESPN ID format
 */
export function standardizeEspnId(id: string, sport?: string): string | null {
  // If already valid, return as is
  if (isValidEspnId(id)) {
    return id
  }
  
  // Try to parse the ID
  const parsed = parseEspnId(id)
  if (parsed) {
    return generateEspnId(parsed.sport, parsed.numericId)
  }
  
  // If sport provided and ID is numeric or espn_numeric
  if (sport) {
    const numericMatch = id.match(/^(?:espn_)?(\d+)$/)
    if (numericMatch) {
      try {
        return generateEspnId(sport, numericMatch[1])
      } catch {
        return null
      }
    }
  }
  
  return null
}

/**
 * Gets the ESPN API endpoint for a sport
 */
export function getEspnApiEndpoint(sport: string): string | null {
  const sportCode = SPORT_MAPPINGS[sport] || SPORT_MAPPINGS[sport.toLowerCase()]
  return sportCode ? ESPN_API_ENDPOINTS[sportCode] : null
}

/**
 * Builds ESPN API URL for a game
 */
export function buildEspnApiUrl(espnId: string): string | null {
  const parsed = parseEspnId(espnId)
  if (!parsed) return null
  
  const endpoint = ESPN_API_ENDPOINTS[parsed.sport]
  if (!endpoint) return null
  
  return `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${parsed.numericId}`
}

/**
 * Extracts numeric ID from various formats
 */
export function extractNumericId(id: string): string | null {
  const match = id.match(/(\d+)/)
  return match ? match[1] : null
}