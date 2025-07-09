import { PrismaClient } from '@prisma/client'
import { cache, RedisCache } from '../../cache/RedisCache'
import { z } from 'zod'
import { aiLogger } from '../../utils/logger'

// Types
export interface Player {
  id: string
  firstName: string
  lastName: string
  position: string[]
  currentTeamId?: string
  jerseyNumber?: number
  height?: number
  weight?: number
  birthDate?: Date
  college?: string
  draftYear?: number
  draftRound?: number
  draftPick?: number
  isActive: boolean
  currentTeam?: {
    id: string
    name: string
    abbreviation: string
  }
}

export interface PlayerStats {
  playerId: string
  season: number
  week?: number
  stats: Record<string, any>
  fantasyPointsPPR?: number
  fantasyPointsStandard?: number
  gamesPlayed: number
}

export interface PlayerWithStats extends Player {
  stats: PlayerStats[]
  injuries?: PlayerInjury[]
}

export interface PlayerInjury {
  id: string
  playerId: string
  injuryType: string
  bodyPart: string
  status: 'questionable' | 'doubtful' | 'out' | 'day-to-day' | 'IR'
  description: string
  reportedDate: Date
  isActive: boolean
}

// Scoring systems
export enum ScoringSystem {
  PPR = 'ppr',
  HALF_PPR = 'half_ppr',
  STANDARD = 'standard'
}

// Cache decorator
function Cacheable(ttlSeconds: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      // cache is already imported
      const key = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`
      
      try {
        const cached = await cache.get(key)
        if (cached) {
          return cached
        }
      } catch (error) {
        aiLogger.error('Cache read error', error)
      }
      
      const result = await originalMethod.apply(this, args)
      
      try {
        await cache.set(key, result, ttlSeconds)
      } catch (error) {
        aiLogger.error('Cache write error', error)
      }
      
      return result
    }
  }
}

export class PlayerService {
  private prisma: PrismaClient
  private cache: RedisCache
  
  constructor() {
    this.prisma = new PrismaClient()
    this.cache = cache
  }
  
  /**
   * Find player by name with fuzzy matching
   */
  @Cacheable(300) // 5 minute cache
  async findPlayerByName(query: string): Promise<Player[]> {
    // Clean and parse the query
    const cleanQuery = query.trim().toLowerCase()
    const nameParts = cleanQuery.split(' ')
    
    // Try exact match first
    const exactMatch = await this.prisma.player.findMany({
      where: {
        OR: [
          {
            AND: [
              { firstName: { equals: nameParts[0], mode: 'insensitive' } },
              { lastName: { equals: nameParts.slice(1).join(' '), mode: 'insensitive' } }
            ]
          },
          { alternateNames: { has: query } }
        ]
      },
      include: { currentTeam: true },
      take: 10
    })
    
    if (exactMatch.length > 0) {
      return exactMatch.map(this.mapToPlayer)
    }
    
    // Fuzzy search
    const fuzzyMatches = await this.prisma.player.findMany({
      where: {
        OR: [
          { firstName: { contains: nameParts[0], mode: 'insensitive' } },
          { lastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } },
          { alternateNames: { hasSome: nameParts } }
        ]
      },
      include: { currentTeam: true },
      take: 20
    })
    
    // Score and sort by relevance
    return this.rankPlayerMatches(fuzzyMatches, cleanQuery).slice(0, 10)
  }
  
  /**
   * Get player with all stats and injury info
   */
  @Cacheable(60) // 1 minute cache for live data
  async getPlayerWithStats(
    playerId: string, 
    season?: number,
    weeks?: number
  ): Promise<PlayerWithStats | null> {
    const currentSeason = season || new Date().getFullYear()
    
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        currentTeam: true,
        stats: {
          where: {
            season: currentSeason
          },
          orderBy: { createdAt: 'desc' },
          take: weeks || 17
        },
        injuries: {
          where: { 
            status: { not: 'healthy' }
          },
          orderBy: { injuryDate: 'desc' },
          take: 1
        }
      }
    })
    
    if (!player) return null
    
    // Map to PlayerWithStats interface
    const mappedPlayer = this.mapToPlayer(player)
    return {
      ...mappedPlayer,
      stats: player.stats.map((stat: any) => ({
        ...stat,
        stats: stat.stats as Record<string, any>
      })),
      injuries: player.injuries.map((injury: any) => ({
        id: injury.id,
        playerId: injury.playerId,
        injuryType: injury.injuryType,
        bodyPart: injury.bodyPart || '',
        status: injury.status || 'questionable',
        description: injury.description || '',
        reportedDate: injury.injuryDate,
        isActive: injury.status !== 'healthy'
      }))
    }
  }
  
  /**
   * Calculate fantasy points for given stats
   */
  calculateFantasyPoints(
    stats: Record<string, any>,
    scoring: ScoringSystem = ScoringSystem.PPR
  ): number {
    let points = 0
    
    // Passing
    points += (stats.passingYards || 0) * 0.04
    points += (stats.passingTouchdowns || 0) * 4
    points += (stats.passingInterceptions || 0) * -2
    
    // Rushing
    points += (stats.rushingYards || 0) * 0.1
    points += (stats.rushingTouchdowns || 0) * 6
    
    // Receiving
    points += (stats.receivingYards || 0) * 0.1
    points += (stats.receivingTouchdowns || 0) * 6
    
    // Receptions (PPR scoring)
    if (scoring === ScoringSystem.PPR) {
      points += (stats.receptions || 0) * 1
    } else if (scoring === ScoringSystem.HALF_PPR) {
      points += (stats.receptions || 0) * 0.5
    }
    
    // Fumbles
    points += (stats.fumblesLost || 0) * -2
    
    // Kicking
    points += (stats.fieldGoalsMade || 0) * 3
    points += (stats.extraPointsMade || 0) * 1
    
    // Defense/Special Teams
    points += (stats.defensiveTouchdowns || 0) * 6
    points += (stats.interceptions || 0) * 2
    points += (stats.sacks || 0) * 1
    points += (stats.safeties || 0) * 2
    
    return Math.round(points * 10) / 10 // Round to 1 decimal
  }
  
  /**
   * Get multiple players by IDs (batch operation)
   */
  async getPlayersByIds(playerIds: string[]): Promise<Map<string, Player>> {
    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { currentTeam: true }
    })
    
    const playerMap = new Map<string, Player>()
    players.forEach(player => {
      playerMap.set(player.id, this.mapToPlayer(player))
    })
    
    return playerMap
  }
  
  /**
   * Search players by position and team
   */
  @Cacheable(300) // 5 minute cache
  async searchPlayers(criteria: {
    position?: string[]
    teamId?: string
    isActive?: boolean
    limit?: number
  }): Promise<Player[]> {
    const { position, teamId, isActive = true, limit = 50 } = criteria
    
    const players = await this.prisma.player.findMany({
      where: {
        ...(position ? { position: { hasSome: position } } : {}),
        ...(teamId ? { currentTeamId: teamId } : {})
        // Note: isActive doesn't exist in database, filter in memory if needed
      },
      include: { currentTeam: true },
      take: limit,
      orderBy: { lastName: 'asc' }
    })
    
    return players.map(player => this.mapToPlayer(player))
  }
  
  /**
   * Get player injury status
   */
  async getPlayerInjuryStatus(playerId: string): Promise<PlayerInjury | null> {
    const injury = await this.prisma.playerInjury.findFirst({
      where: {
        playerId,
        status: { not: 'healthy' }
      },
      orderBy: { injuryDate: 'desc' }
    })
    
    if (!injury) return null
    
    return {
      id: injury.id,
      playerId: injury.playerId,
      injuryType: injury.injuryType,
      bodyPart: injury.bodyPart || '',
      status: (injury.status === 'healthy' ? 'questionable' : injury.status) as any || 'questionable',
      description: injury.description || '',
      reportedDate: injury.injuryDate,
      isActive: injury.status !== 'healthy'
    }
  }
  
  /**
   * Rank player matches by relevance
   */
  private rankPlayerMatches(players: any[], query: string): Player[] {
    return players
      .map(player => {
        let score = 0
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase()
        
        // Exact match
        if (fullName === query) score += 100
        
        // Starts with query
        if (fullName.startsWith(query)) score += 50
        
        // Contains query
        if (fullName.includes(query)) score += 25
        
        // Last name match
        if (player.lastName.toLowerCase() === query.split(' ').pop()) score += 30
        
        // Active player bonus
        if (player.isActive) score += 10
        
        return { player, score }
      })
      .sort((a, b) => b.score - a.score)
      .map(item => this.mapToPlayer(item.player))
  }
  
  /**
   * Get trending players based on recent performance
   */
  @Cacheable(3600) // 1 hour cache
  async getTrendingPlayers(
    position?: string[],
    limit: number = 10
  ): Promise<Player[]> {
    const recentWeek = await this.getCurrentWeek()
    
    // Get players with significant fantasy point increases
    const trendingPlayers = await this.prisma.$queryRaw`
      SELECT 
        p.*,
        AVG(CASE WHEN ps.week >= ${recentWeek - 2} THEN ps.fantasy_points_ppr ELSE 0 END) as recent_avg,
        AVG(CASE WHEN ps.week < ${recentWeek - 2} THEN ps.fantasy_points_ppr ELSE 0 END) as previous_avg
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      WHERE 
        ps.season = ${new Date().getFullYear()}
        ${position ? `AND p.position && ARRAY[${position.join(',')}]` : ''}
      GROUP BY p.id
      HAVING AVG(CASE WHEN ps.week >= ${recentWeek - 2} THEN ps.fantasy_points_ppr ELSE 0 END) > 
             AVG(CASE WHEN ps.week < ${recentWeek - 2} THEN ps.fantasy_points_ppr ELSE 0 END) * 1.2
      ORDER BY recent_avg DESC
      LIMIT ${limit}
    `
    
    return trendingPlayers as Player[]
  }
  
  /**
   * Get current NFL week
   */
  private async getCurrentWeek(): Promise<number> {
    // Simple calculation - can be improved with actual NFL calendar
    const seasonStart = new Date(new Date().getFullYear(), 8, 7) // Sept 7
    const now = new Date()
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    return Math.min(Math.max(1, weeksSinceStart + 1), 18)
  }
  
  /**
   * Cleanup resources
   */
  async disconnect() {
    await this.prisma.$disconnect()
  }

  /**
   * Map Prisma player model to Player interface
   */
  private mapToPlayer(player: any): Player {
    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      currentTeamId: player.currentTeamId,
      jerseyNumber: player.jerseyNumber,
      height: player.height,
      weight: player.weight,
      birthDate: player.birthDate,
      college: player.college,
      draftYear: player.draftYear,
      draftRound: player.draftRound,
      draftPick: player.draftPick,
      isActive: player.isActive ?? true,
      currentTeam: player.currentTeam ? {
        id: player.currentTeam.id,
        name: player.currentTeam.name,
        abbreviation: player.currentTeam.abbreviation
      } : undefined
    }
  }
}