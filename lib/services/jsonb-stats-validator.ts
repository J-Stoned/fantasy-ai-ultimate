/**
 * 🔍 JSONB STATS VALIDATOR
 * 
 * Validates sport-specific stats stored in JSONB format
 * Ensures data integrity for our standardized player_game_logs schema
 * 
 * Features:
 * - Sport-specific validation rules
 * - JSONB structure validation
 * - Fantasy points verification
 * - Data quality checks
 * - Compression validation (Lucey-inspired)
 */

import chalk from 'chalk'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  compressionScore?: number // How well does it compress (Lucey principle)
}

export interface StatsValidationOptions {
  sport?: string
  strictMode?: boolean
  checkCompression?: boolean
  allowMissingFields?: boolean
}

export class JSONBStatsValidator {
  
  /**
   * Validate NBA stats in JSONB format
   */
  static validateNBAStats(stats: any, options: StatsValidationOptions = {}): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Required NBA fields
    const requiredFields = ['points', 'rebounds', 'assists', 'minutes_played']
    const optionalFields = [
      'field_goals_made', 'field_goals_attempted',
      'three_pointers_made', 'three_pointers_attempted',
      'free_throws_made', 'free_throws_attempted',
      'offensive_rebounds', 'defensive_rebounds',
      'steals', 'blocks', 'turnovers', 'personal_fouls'
    ]
    
    // Check required fields
    for (const field of requiredFields) {
      if (stats[field] === undefined || stats[field] === null) {
        if (options.strictMode) {
          errors.push(`Missing required NBA field: ${field}`)
        } else {
          warnings.push(`Missing NBA field: ${field}`)
        }
      }
    }
    
    // Validate data types and ranges
    this.validateNumericField(stats, 'points', { min: 0, max: 100 }, errors, warnings)
    this.validateNumericField(stats, 'rebounds', { min: 0, max: 50 }, errors, warnings)
    this.validateNumericField(stats, 'assists', { min: 0, max: 30 }, errors, warnings)
    this.validateNumericField(stats, 'minutes_played', { min: 0, max: 48 }, errors, warnings)
    
    // Validate shooting percentages
    if (stats.field_goals_made > stats.field_goals_attempted) {
      errors.push('Field goals made cannot exceed attempts')
    }
    
    if (stats.three_pointers_made > stats.three_pointers_attempted) {
      errors.push('Three pointers made cannot exceed attempts')
    }
    
    if (stats.free_throws_made > stats.free_throws_attempted) {
      errors.push('Free throws made cannot exceed attempts')
    }
    
    // Check rebounds consistency
    if (stats.offensive_rebounds !== undefined && stats.defensive_rebounds !== undefined) {
      const totalRebounds = stats.offensive_rebounds + stats.defensive_rebounds
      if (Math.abs(totalRebounds - stats.rebounds) > 1) {
        warnings.push('Total rebounds inconsistent with offensive + defensive')
      }
    }
    
    // Compression check (Lucey principle)
    let compressionScore = 0
    if (options.checkCompression) {
      compressionScore = this.calculateCompressionScore(stats, [
        'points', 'rebounds', 'assists', 'steals', 'blocks'
      ])
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compressionScore
    }
  }
  
  /**
   * Validate MLB stats in JSONB format
   */
  static validateMLBStats(stats: any, options: StatsValidationOptions = {}): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Required MLB fields
    const requiredFields = ['at_bats', 'hits', 'runs', 'rbis']
    
    // Check required fields
    for (const field of requiredFields) {
      if (stats[field] === undefined || stats[field] === null) {
        if (options.strictMode) {
          errors.push(`Missing required MLB field: ${field}`)
        } else {
          warnings.push(`Missing MLB field: ${field}`)
        }
      }
    }
    
    // Validate data types and ranges
    this.validateNumericField(stats, 'at_bats', { min: 0, max: 15 }, errors, warnings)
    this.validateNumericField(stats, 'hits', { min: 0, max: 10 }, errors, warnings)
    this.validateNumericField(stats, 'runs', { min: 0, max: 10 }, errors, warnings)
    this.validateNumericField(stats, 'rbis', { min: 0, max: 15 }, errors, warnings)
    
    // Validate baseball logic
    if (stats.hits > stats.at_bats && stats.at_bats > 0) {
      errors.push('Hits cannot exceed at bats')
    }
    
    // Validate hit types
    if (stats.singles !== undefined && stats.doubles !== undefined && 
        stats.triples !== undefined && stats.home_runs !== undefined) {
      const totalHitTypes = stats.singles + stats.doubles + stats.triples + stats.home_runs
      if (Math.abs(totalHitTypes - stats.hits) > 1) {
        warnings.push('Hit types do not sum to total hits')
      }
    }
    
    // Compression check
    let compressionScore = 0
    if (options.checkCompression) {
      compressionScore = this.calculateCompressionScore(stats, [
        'hits', 'runs', 'rbis', 'home_runs'
      ])
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compressionScore
    }
  }
  
  /**
   * Validate NFL stats in JSONB format
   */
  static validateNFLStats(stats: any, options: StatsValidationOptions = {}): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // NFL can have passing, rushing, or receiving stats
    const hasPassingStats = stats.passing_yards !== undefined
    const hasRushingStats = stats.rushing_yards !== undefined
    const hasReceivingStats = stats.receiving_yards !== undefined
    
    if (!hasPassingStats && !hasRushingStats && !hasReceivingStats) {
      errors.push('NFL stats must have at least one of: passing, rushing, or receiving stats')
    }
    
    // Validate passing stats
    if (hasPassingStats) {
      this.validateNumericField(stats, 'passing_yards', { min: -50, max: 600 }, errors, warnings)
      this.validateNumericField(stats, 'passing_touchdowns', { min: 0, max: 10 }, errors, warnings)
      this.validateNumericField(stats, 'interceptions', { min: 0, max: 10 }, errors, warnings)
      
      if (stats.passing_completions > stats.passing_attempts) {
        errors.push('Passing completions cannot exceed attempts')
      }
    }
    
    // Validate rushing stats
    if (hasRushingStats) {
      this.validateNumericField(stats, 'rushing_yards', { min: -50, max: 400 }, errors, warnings)
      this.validateNumericField(stats, 'rushing_touchdowns', { min: 0, max: 10 }, errors, warnings)
    }
    
    // Validate receiving stats
    if (hasReceivingStats) {
      this.validateNumericField(stats, 'receiving_yards', { min: -50, max: 400 }, errors, warnings)
      this.validateNumericField(stats, 'receiving_touchdowns', { min: 0, max: 10 }, errors, warnings)
    }
    
    // Compression check
    let compressionScore = 0
    if (options.checkCompression) {
      const keyStats = []
      if (hasPassingStats) keyStats.push('passing_yards', 'passing_touchdowns')
      if (hasRushingStats) keyStats.push('rushing_yards', 'rushing_touchdowns')
      if (hasReceivingStats) keyStats.push('receiving_yards', 'receiving_touchdowns')
      
      compressionScore = this.calculateCompressionScore(stats, keyStats)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compressionScore
    }
  }
  
  /**
   * Validate JSONB stats based on sport
   */
  static validateStats(
    stats: any, 
    sport: string, 
    options: StatsValidationOptions = {}
  ): ValidationResult {
    if (!stats || typeof stats !== 'object') {
      return {
        isValid: false,
        errors: ['Stats must be a valid object'],
        warnings: []
      }
    }
    
    switch (sport.toUpperCase()) {
      case 'NBA':
      case 'BASKETBALL':
        return this.validateNBAStats(stats, options)
      
      case 'MLB':
      case 'BASEBALL':
        return this.validateMLBStats(stats, options)
      
      case 'NFL':
      case 'FOOTBALL':
        return this.validateNFLStats(stats, options)
      
      default:
        return {
          isValid: true,
          errors: [],
          warnings: [`Unknown sport: ${sport} - skipping validation`]
        }
    }
  }
  
  /**
   * Validate complete player_game_logs record
   */
  static validatePlayerGameLog(record: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Validate schema fields
    if (!record.player_id || typeof record.player_id !== 'number') {
      errors.push('player_id is required and must be a number')
    }
    
    if (!record.game_id || typeof record.game_id !== 'number') {
      errors.push('game_id is required and must be a number')
    }
    
    if (!record.team_id || typeof record.team_id !== 'number') {
      errors.push('team_id is required and must be a number')
    }
    
    if (!record.game_date) {
      errors.push('game_date is required')
    }
    
    if (!record.stats || typeof record.stats !== 'object') {
      errors.push('stats must be a valid JSONB object')
    }
    
    if (record.fantasy_points === undefined || typeof record.fantasy_points !== 'number') {
      errors.push('fantasy_points is required and must be a number')
    }
    
    // Validate stats JSONB if present
    if (record.stats && typeof record.stats === 'object') {
      // Try to determine sport from stats structure
      const sport = this.detectSportFromStats(record.stats)
      if (sport) {
        const statsValidation = this.validateStats(record.stats, sport, { checkCompression: true })
        errors.push(...statsValidation.errors)
        warnings.push(...statsValidation.warnings)
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Detect sport from stats structure
   */
  private static detectSportFromStats(stats: any): string | null {
    if (stats.points !== undefined && stats.rebounds !== undefined) {
      return 'NBA'
    }
    
    if (stats.at_bats !== undefined && stats.hits !== undefined) {
      return 'MLB'
    }
    
    if (stats.passing_yards !== undefined || stats.rushing_yards !== undefined) {
      return 'NFL'
    }
    
    return null
  }
  
  /**
   * Validate numeric field with range
   */
  private static validateNumericField(
    stats: any,
    field: string,
    range: { min?: number; max?: number },
    errors: string[],
    warnings: string[]
  ) {
    const value = stats[field]
    
    if (value !== undefined) {
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`${field} must be a valid number`)
        return
      }
      
      if (range.min !== undefined && value < range.min) {
        warnings.push(`${field} is below expected range (${value} < ${range.min})`)
      }
      
      if (range.max !== undefined && value > range.max) {
        warnings.push(`${field} is above expected range (${value} > ${range.max})`)
      }
    }
  }
  
  /**
   * Calculate compression score (Lucey principle)
   * Higher score = better compression potential
   */
  private static calculateCompressionScore(stats: any, keyFields: string[]): number {
    const totalFields = Object.keys(stats).length
    const nonZeroKeyFields = keyFields.filter(field => stats[field] && stats[field] > 0).length
    
    if (totalFields === 0) return 0
    
    // Score based on ratio of meaningful fields to total fields
    const ratio = nonZeroKeyFields / totalFields
    return Math.round(ratio * 100) // 0-100 score
  }
  
  /**
   * Get compression summary for stats
   */
  static getCompressionSummary(stats: any, sport: string): {
    originalSize: number
    compressedSize: number
    ratio: number
    essentialFields: string[]
  } {
    const originalSize = Object.keys(stats).length
    
    let essentialFields: string[] = []
    
    switch (sport.toUpperCase()) {
      case 'NBA':
        essentialFields = ['points', 'rebounds', 'assists', 'steals', 'blocks']
        break
      case 'MLB':
        essentialFields = ['hits', 'runs', 'rbis', 'home_runs']
        break
      case 'NFL':
        essentialFields = ['passing_yards', 'rushing_yards', 'receiving_yards', 'passing_touchdowns', 'rushing_touchdowns', 'receiving_touchdowns']
        break
    }
    
    const compressedSize = essentialFields.filter(field => stats[field] !== undefined).length
    const ratio = originalSize > 0 ? compressedSize / originalSize : 0
    
    return {
      originalSize,
      compressedSize,
      ratio,
      essentialFields
    }
  }
  
  /**
   * Batch validate multiple player game logs
   */
  static validateBatch(records: any[]): {
    valid: any[]
    invalid: any[]
    totalErrors: number
    totalWarnings: number
  } {
    const valid: any[] = []
    const invalid: any[] = []
    let totalErrors = 0
    let totalWarnings = 0
    
    for (const record of records) {
      const validation = this.validatePlayerGameLog(record)
      
      totalErrors += validation.errors.length
      totalWarnings += validation.warnings.length
      
      if (validation.isValid) {
        valid.push(record)
      } else {
        invalid.push(record)
        console.warn(chalk.yellow(`⚠️ Invalid record:`, validation.errors))
      }
    }
    
    return {
      valid,
      invalid,
      totalErrors,
      totalWarnings
    }
  }
  
  /**
   * Log validation results
   */
  static logValidationResult(entityType: string, id: any, result: ValidationResult) {
    if (!result.isValid) {
      console.error(chalk.red(`\n❌ Validation failed for ${entityType} ${id}:`))
      result.errors.forEach(error => {
        console.error(chalk.red(`  ✗ ${error}`))
      })
    }
    
    if (result.warnings.length > 0) {
      console.warn(chalk.yellow(`\n⚠️ Warnings for ${entityType} ${id}:`))
      result.warnings.forEach(warning => {
        console.warn(chalk.yellow(`  ⚠ ${warning}`))
      })
    }
    
    if (result.compressionScore !== undefined) {
      console.log(chalk.blue(`📊 Compression score: ${result.compressionScore}%`))
    }
  }
}

// Export convenience functions
export const validateNBAStats = JSONBStatsValidator.validateNBAStats
export const validateMLBStats = JSONBStatsValidator.validateMLBStats
export const validateNFLStats = JSONBStatsValidator.validateNFLStats
export const validateStats = JSONBStatsValidator.validateStats
export const validatePlayerGameLog = JSONBStatsValidator.validatePlayerGameLog