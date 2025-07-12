/**
 * DATA VALIDATION SERVICE
 * Ensures data integrity and consistency across the platform
 */

import chalk from 'chalk'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class DataValidationService {
  /**
   * Validate game data before insertion/update
   */
  static validateGame(game: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Required fields
    if (!game.sport) errors.push('Sport is required')
    if (!game.start_time) errors.push('Start time is required')
    if (!game.home_team_id) errors.push('Home team ID is required')
    if (!game.away_team_id) errors.push('Away team ID is required')
    
    // Validate sport values
    const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB']
    if (game.sport && !validSports.includes(game.sport)) {
      errors.push(`Invalid sport: ${game.sport}. Must be one of: ${validSports.join(', ')}`)
    }
    
    // Validate teams
    if (game.home_team_id === game.away_team_id) {
      errors.push('Home and away teams cannot be the same')
    }
    
    // Validate IDs
    if (game.universal_id && !this.isValidUniversalId(game.universal_id)) {
      errors.push(`Invalid universal ID format: ${game.universal_id}`)
    }
    
    // Warnings
    if (!game.universal_id) warnings.push('No universal ID provided')
    if (!game.external_id && !game.universal_id) warnings.push('No game identifiers provided')
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Validate player game log data
   */
  static validatePlayerGameLog(log: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Required fields
    if (!log.game_id) errors.push('Game ID is required')
    if (!log.player_id) errors.push('Player ID is required')
    if (!log.team_id) errors.push('Team ID is required')
    if (log.fantasy_points === undefined) errors.push('Fantasy points is required')
    
    // Validate fantasy points
    if (log.fantasy_points < -50) {
      warnings.push(`Unusually low fantasy points: ${log.fantasy_points}`)
    }
    if (log.fantasy_points > 100) {
      warnings.push(`Unusually high fantasy points: ${log.fantasy_points}`)
    }
    
    // Validate stats based on sport
    if (log.stats) {
      const statsWarnings = this.validateStats(log.stats, log.sport)
      warnings.push(...statsWarnings)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Validate universal ID format
   */
  static isValidUniversalId(universalId: string): boolean {
    // Format: {sport}_{YYYYMMDD}_{HHMM}_{home}_{away}
    const pattern = /^[a-z]+_\d{8}_\d{4}_[a-z0-9]+_[a-z0-9]+(_\d+)?$/
    return pattern.test(universalId)
  }
  
  /**
   * Validate stats based on sport
   */
  private static validateStats(stats: any, sport?: string): string[] {
    const warnings: string[] = []
    
    // Check for negative values where they shouldn't be
    const nonNegativeFields = [
      'points', 'rebounds', 'assists', 'steals', 'blocks',
      'passing_yards', 'rushing_yards', 'receiving_yards',
      'at_bats', 'hits', 'runs', 'rbi', 'walks',
      'innings_pitched', 'strikeouts'
    ]
    
    for (const field of nonNegativeFields) {
      if (stats[field] !== undefined && stats[field] < 0) {
        warnings.push(`Negative value for ${field}: ${stats[field]}`)
      }
    }
    
    // Sport-specific validations
    if (sport === 'NFL' || sport === 'NCAAF') {
      if (stats.passing_yards > 600) {
        warnings.push(`Unusually high passing yards: ${stats.passing_yards}`)
      }
      if (stats.rushing_yards > 300) {
        warnings.push(`Unusually high rushing yards: ${stats.rushing_yards}`)
      }
    }
    
    if (sport === 'NBA' || sport === 'NCAAB') {
      if (stats.points > 70) {
        warnings.push(`Unusually high points: ${stats.points}`)
      }
      if (stats.rebounds > 30) {
        warnings.push(`Unusually high rebounds: ${stats.rebounds}`)
      }
    }
    
    if (sport === 'MLB') {
      if (stats.hits > stats.at_bats && stats.at_bats > 0) {
        warnings.push(`More hits than at bats: ${stats.hits} hits in ${stats.at_bats} AB`)
      }
      if (stats.innings_pitched > 15) {
        warnings.push(`Unusually high innings pitched: ${stats.innings_pitched}`)
      }
    }
    
    return warnings
  }
  
  /**
   * Log validation results
   */
  static logValidationResult(entityType: string, id: any, result: ValidationResult) {
    if (!result.isValid) {
      console.error(chalk.red(`\nValidation failed for ${entityType} ${id}:`))
      result.errors.forEach(error => {
        console.error(chalk.red(`  ✗ ${error}`))
      })
    }
    
    if (result.warnings.length > 0) {
      console.warn(chalk.yellow(`\nWarnings for ${entityType} ${id}:`))
      result.warnings.forEach(warning => {
        console.warn(chalk.yellow(`  ⚠ ${warning}`))
      })
    }
  }
  
  /**
   * Validate batch of records
   */
  static validateBatch<T>(
    records: T[],
    validator: (record: T) => ValidationResult,
    entityType: string
  ): { valid: T[], invalid: T[] } {
    const valid: T[] = []
    const invalid: T[] = []
    
    records.forEach((record: any) => {
      const result = validator(record)
      
      if (result.isValid) {
        valid.push(record)
      } else {
        invalid.push(record)
        this.logValidationResult(entityType, record.id || 'unknown', result)
      }
    })
    
    if (invalid.length > 0) {
      console.log(chalk.yellow(`\nValidation summary: ${valid.length} valid, ${invalid.length} invalid`))
    }
    
    return { valid, invalid }
  }
}