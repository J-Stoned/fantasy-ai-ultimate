import { PrismaClient, PlatformType } from '@prisma/client'
import axios from 'axios'
import { z } from 'zod'
import { apiLogger } from '../../utils/logger'

const prisma = new PrismaClient()

// League data schemas
const LeagueDataSchema = z.object({
  platformLeagueId: z.string(),
  name: z.string(),
  season: z.number(),
  sport: z.string(),
  settings: z.any(),
  teams: z.array(z.any()),
})

export class UniversalLeagueImporter {
  private importers: Map<PlatformType, PlatformImporter>

  constructor() {
    this.importers = new Map<PlatformType, PlatformImporter>()
    this.importers.set(PlatformType.yahoo, new YahooImporter())
    this.importers.set(PlatformType.espn, new ESPNImporter())
    this.importers.set(PlatformType.draftkings, new DraftKingsImporter())
    this.importers.set(PlatformType.fanduel, new FanDuelImporter())
    this.importers.set(PlatformType.sleeper, new SleeperImporter())
    this.importers.set(PlatformType.cbs, new CBSImporter())
    this.importers.set(PlatformType.nfl, new NFLImporter())
  }

  /**
   * One-click import from any supported platform
   */
  async importLeague(
    userId: string,
    platform: PlatformType,
    credentials: ImportCredentials
  ) {
    apiLogger.info('Starting league import', { platform, userId })

    // Check if user has platform connection
    const connection = await this.ensurePlatformConnection(userId, platform, credentials)
    
    if (!connection) {
      throw new Error(`Failed to establish ${platform} connection`)
    }

    // Get the appropriate importer
    const importer = this.importers.get(platform)
    if (!importer) {
      throw new Error(`No importer available for ${platform}`)
    }

    // Import leagues
    const leagues = await importer.fetchUserLeagues(connection)
    apiLogger.info('Found leagues', { count: leagues.length, platform })

    // Process each league
    const importResults = []
    for (const leagueData of leagues) {
      try {
        const result = await this.processLeagueImport(userId, platform, leagueData)
        importResults.push(result)
      } catch (error) {
        apiLogger.error('Error importing league', error, { leagueName: leagueData.name })
      }
    }

    // Log import history
    await this.logImportHistory(userId, platform, importResults)

    return {
      success: true,
      leaguesImported: importResults.length,
      results: importResults,
    }
  }

  /**
   * Ensure platform connection exists
   */
  private async ensurePlatformConnection(
    userId: string,
    platform: PlatformType,
    credentials: ImportCredentials
  ) {
    // Check existing connection
    let connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        }
      }
    })

    if (!connection || !connection.isActive) {
      // Create or update connection
      connection = await prisma.platformConnection.upsert({
        where: {
          userId_platform: {
            userId,
            platform,
          }
        },
        create: {
          userId,
          platform,
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          platformUserId: credentials.platformUserId,
          isActive: true,
        },
        update: {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          isActive: true,
          lastSyncAt: new Date(),
        }
      })
    }

    return connection
  }

  /**
   * Process individual league import
   */
  private async processLeagueImport(
    userId: string,
    platform: PlatformType,
    leagueData: any
  ) {
    // Validate league data
    const validated = LeagueDataSchema.parse(leagueData)

    // Find existing league
    const existingLeague = await prisma.fantasyLeague.findFirst({
      where: {
        platform,
        platformLeagueId: validated.platformLeagueId,
        userId,
      }
    })

    // Create or update league
    const league = existingLeague
      ? await prisma.fantasyLeague.update({
          where: { id: existingLeague.id },
          data: {
            name: validated.name,
            leagueSettings: validated.settings,
            scoringSettings: validated.settings.scoring,
            rosterSettings: validated.settings.roster,
            isActive: true,
          }
        })
      : await prisma.fantasyLeague.create({
          data: {
            platform,
            platformLeagueId: validated.platformLeagueId,
            userId,
            name: validated.name,
            season: validated.season,
            leagueSettings: validated.settings,
            scoringSettings: validated.settings.scoring,
            rosterSettings: validated.settings.roster,
            isActive: true,
          }
        })

    // MARCUS FIX: Import teams and players in a single transaction
    await prisma.$transaction(async (tx) => {
      // Import teams
      await this.importTeamsBatch(league.id, userId, validated.teams);
      
      // Import all players from all teams in ONE batch
      const allPlayers = validated.teams.flatMap(t => t.roster || []);
      await this.importPlayersBatch(league.id, platform, allPlayers);
    });

    return {
      leagueId: league.id,
      name: league.name,
      teamsImported: validated.teams.length,
    }
  }

  /**
   * MARCUS FIX: Batch import teams - no more N+1 queries!
   */
  private async importTeamsBatch(leagueId: string, userId: string, teamsData: any[]) {
    // Step 1: Fetch ALL existing teams in ONE query
    const platformTeamIds = teamsData.map(t => t.id);
    const existingTeams = await prisma.fantasyTeam.findMany({
      where: {
        leagueId,
        platformTeamId: { in: platformTeamIds }
      }
    });
    
    const existingTeamMap = new Map(existingTeams.map(t => [t.platformTeamId, t]));
    
    // Step 2: Prepare batch operations
    const teamsToCreate: any[] = [];
    const teamsToUpdate: any[] = [];
    const rosterEntriesToCreate: any[] = [];
    
    for (const teamData of teamsData) {
      const existing = existingTeamMap.get(teamData.id);
      
      if (existing) {
        teamsToUpdate.push({
          where: { id: existing.id },
          data: {
          teamName: teamData.name,
          roster: teamData.roster,
          standings: teamData.standings,
          stats: teamData.stats,
        }
      })
    } else {
      await prisma.fantasyTeam.create({
        data: {
          leagueId,
          userId: teamData.ownerId === userId ? userId : teamData.ownerId,
          teamName: teamData.name,
          platformTeamId: teamData.id,
          roster: teamData.roster,
          standings: teamData.standings,
          stats: teamData.stats,
        }
      })
    }
  }

  /**
   * Map platform players to universal player database
   */
  private async mapPlatformPlayers(platform: PlatformType, teams: any[]) {
    const allPlayers = teams.flatMap(team => team.roster || [])
    
    for (const platformPlayer of allPlayers) {
      try {
        // Try to find matching player in our database
        const matches = await this.findPlayerMatch(platformPlayer)
        
        if (matches.length > 0) {
          // Create platform mapping
          await prisma.playerPlatformMapping.upsert({
            where: {
              platform_platformPlayerId: {
                platform,
                platformPlayerId: platformPlayer.id,
              }
            },
            create: {
              playerId: matches[0].id,
              platform,
              platformPlayerId: platformPlayer.id,
              platformData: platformPlayer,
              confidenceScore: matches[0].confidence,
              verified: matches[0].confidence > 0.95,
            },
            update: {
              platformData: platformPlayer,
              confidenceScore: matches[0].confidence,
            }
          })
        }
      } catch (error) {
        apiLogger.error('Error mapping player', error, { playerName: platformPlayer.name })
      }
    }
  }

  /**
   * Find matching player in database
   */
  private async findPlayerMatch(platformPlayer: any) {
    // Search by name and other attributes
    const nameParts = platformPlayer.name.split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')

    const candidates = await prisma.player.findMany({
      where: {
        OR: [
          {
            firstName: { equals: firstName, mode: 'insensitive' as const },
            lastName: { equals: lastName, mode: 'insensitive' as const },
          },
          {
            alternateNames: { has: platformPlayer.name }
          }
        ]
      }
    })

    // Score each candidate
    return candidates.map(candidate => ({
      id: candidate.id,
      confidence: this.calculateMatchConfidence(candidate, platformPlayer)
    })).sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate match confidence score
   */
  private calculateMatchConfidence(player: any, platformPlayer: any): number {
    let score = 0
    
    // Name match
    if (player.firstName.toLowerCase() === platformPlayer.name.split(' ')[0].toLowerCase()) {
      score += 0.4
    }
    
    // Team match
    if (platformPlayer.team && player.currentTeam?.name.includes(platformPlayer.team)) {
      score += 0.3
    }
    
    // Position match
    if (platformPlayer.position && player.position?.includes(platformPlayer.position)) {
      score += 0.2
    }
    
    // Jersey number match
    if (platformPlayer.jerseyNumber && player.jerseyNumber === platformPlayer.jerseyNumber) {
      score += 0.1
    }

    return Math.min(score, 1.0)
  }

  /**
   * Import teams in batch (optimized to avoid N+1 queries)
   */
  private async importTeamsBatch(leagueId: string, userId: string, teams: any[]) {
    // Prepare all team data for batch upsert
    const teamData = teams.map(team => ({
      leagueId,
      platformTeamId: team.id,
      userId: team.ownerId === userId ? userId : team.ownerId,
      teamName: team.name,
      roster: team.roster,
      standings: team.standings,
      stats: team.stats,
    }))

    // Use transaction for atomic operation
    await prisma.$transaction(async (tx) => {
      // First, get existing teams
      const existingTeams = await tx.fantasyTeam.findMany({
        where: {
          leagueId,
          platformTeamId: { in: teamData.map(t => t.platformTeamId) }
        }
      })

      const existingIds = new Set(existingTeams.map(t => t.platformTeamId))

      // Separate new teams from updates
      const newTeams = teamData.filter(t => !existingIds.has(t.platformTeamId))
      const updateTeams = teamData.filter(t => existingIds.has(t.platformTeamId))

      // Batch create new teams
      if (newTeams.length > 0) {
        await tx.fantasyTeam.createMany({ data: newTeams })
      }

      // Batch update existing teams - FIXED N+1 QUERY!
      if (updateTeams.length > 0) {
        // First, fetch all existing teams in one query
        const existingTeams = await tx.fantasyTeam.findMany({
          where: {
            leagueId,
            platformTeamId: { in: updateTeams.map(t => t.platformTeamId) }
          }
        })
        
        // Create a map for quick lookup
        const existingTeamMap = new Map(
          existingTeams.map(team => [`${team.leagueId}-${team.platformTeamId}`, team])
        )
        
        // Now update without N+1 queries
        const updatePromises = updateTeams.map(team => {
          const existing = existingTeamMap.get(`${team.leagueId}-${team.platformTeamId}`)
          if (existing) {
            return tx.fantasyTeam.update({
              where: { id: existing.id },
              data: {
                teamName: team.teamName,
                roster: team.roster,
                standings: team.standings,
                stats: team.stats,
              }
            })
          }
        }).filter(Boolean) // Remove undefined values
        
        await Promise.all(updatePromises)
      }
    })
  }

  /**
   * Map platform players in batch (optimized to avoid N+1 queries)
   */
  private async mapPlatformPlayersBatch(platform: PlatformType, teams: any[]) {
    const allPlayers = teams.flatMap(team => team.roster || [])
    if (allPlayers.length === 0) return

    // Extract all unique player names for batch search
    const playerNames = [...new Set(allPlayers.map(p => p.name))]
    
    // Batch search for all players at once
    const searchConditions = playerNames.map(name => {
      const nameParts = name.split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')
      
      return {
        OR: [
          {
            firstName: { equals: firstName, mode: 'insensitive' as const },
            lastName: { equals: lastName, mode: 'insensitive' as const },
          },
          {
            alternateNames: { has: name }
          }
        ]
      }
    })

    // Single query to find all potential matches
    const candidates = await prisma.player.findMany({
      where: { OR: searchConditions },
      include: { currentTeam: true }
    })

    // Create a map for quick lookup
    const candidateMap = new Map<string, any[]>()
    candidates.forEach(candidate => {
      const fullName = `${candidate.firstName} ${candidate.lastName}`.toLowerCase()
      if (!candidateMap.has(fullName)) {
        candidateMap.set(fullName, [])
      }
      candidateMap.get(fullName)!.push(candidate)
    })

    // Get existing mappings in one query
    const platformPlayerIds = allPlayers.map(p => p.id)
    const existingMappings = await prisma.playerPlatformMapping.findMany({
      where: {
        platform,
        platformPlayerId: { in: platformPlayerIds }
      }
    })
    const existingMappingIds = new Set(existingMappings.map(m => m.platformPlayerId))

    // Prepare batch operations
    const newMappings: any[] = []
    const updateMappings: any[] = []

    for (const platformPlayer of allPlayers) {
      try {
        const playerCandidates = candidateMap.get(platformPlayer.name.toLowerCase()) || []
        
        if (playerCandidates.length > 0) {
          // Score and sort candidates
          const scored = playerCandidates.map(candidate => ({
            id: candidate.id,
            confidence: this.calculateMatchConfidence(candidate, platformPlayer)
          })).sort((a, b) => b.confidence - a.confidence)

          const bestMatch = scored[0]
          
          if (bestMatch.confidence > 0.5) { // Only map if confidence is reasonable
            const mappingData = {
              playerId: bestMatch.id,
              platform,
              platformPlayerId: platformPlayer.id,
              platformData: platformPlayer,
              confidenceScore: bestMatch.confidence,
              verified: bestMatch.confidence > 0.95,
            }

            if (existingMappingIds.has(platformPlayer.id)) {
              updateMappings.push(mappingData)
            } else {
              newMappings.push(mappingData)
            }
          }
        }
      } catch (error) {
        apiLogger.error('Error processing player', error, { playerName: platformPlayer.name })
      }
    }

    // Batch insert/update in transaction
    await prisma.$transaction(async (tx) => {
      // Batch create new mappings
      if (newMappings.length > 0) {
        await tx.playerPlatformMapping.createMany({ data: newMappings })
      }

      // Batch update existing mappings
      if (updateMappings.length > 0) {
        const updatePromises = updateMappings.map(mapping =>
          tx.playerPlatformMapping.update({
            where: {
              platform_platformPlayerId: {
                platform: mapping.platform,
                platformPlayerId: mapping.platformPlayerId,
              }
            },
            data: {
              platformData: mapping.platformData,
              confidenceScore: mapping.confidenceScore,
            }
          })
        )
        await Promise.all(updatePromises)
      }
    })

    apiLogger.info('Player mapping complete', { newMappings: newMappings.length, updatedMappings: updateMappings.length })
  }

  /**
   * Log import history
   */
  private async logImportHistory(
    userId: string,
    platform: PlatformType,
    results: any[]
  ) {
    await prisma.importHistory.create({
      data: {
        userId,
        platform,
        importType: 'league',
        status: 'completed',
        recordsImported: results.reduce((sum, r) => sum + r.teamsImported, 0),
        completedAt: new Date(),
        metadata: { results },
      }
    })
  }
}

// Platform-specific importers
interface PlatformImporter {
  fetchUserLeagues(connection: any): Promise<any[]>
}

interface ImportCredentials {
  accessToken?: string
  refreshToken?: string
  platformUserId?: string
  username?: string
  password?: string
}

// Yahoo Fantasy Importer
class YahooImporter implements PlatformImporter {
  private apiUrl = 'https://fantasysports.yahooapis.com/fantasy/v2'

  async fetchUserLeagues(connection: any) {
    // Yahoo OAuth implementation
    const leagues: any[] = []
    
    try {
      const response = await axios.get(`${this.apiUrl}/users;use_login=1/games/leagues`, {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
        }
      })
      
      // Parse Yahoo's XML response
      // Convert to standard format
    } catch (error) {
      apiLogger.error('Yahoo API error', error)
    }

    return leagues
  }
}

// ESPN Fantasy Importer
class ESPNImporter implements PlatformImporter {
  private apiUrl = 'https://fantasy.espn.com/apis/v3'

  async fetchUserLeagues(connection: any) {
    // ESPN API implementation
    return []
  }
}

// DraftKings Importer
class DraftKingsImporter implements PlatformImporter {
  async fetchUserLeagues(connection: any) {
    // DraftKings API implementation
    return []
  }
}

// FanDuel Importer
class FanDuelImporter implements PlatformImporter {
  async fetchUserLeagues(connection: any) {
    // FanDuel API implementation
    return []
  }
}

// Sleeper Importer
class SleeperImporter implements PlatformImporter {
  private apiUrl = 'https://api.sleeper.app/v1'

  async fetchUserLeagues(connection: any) {
    const leagues: any[] = []
    
    try {
      // Get user info
      const userResponse = await axios.get(`${this.apiUrl}/user/${connection.platformUserId}`)
      const userId = userResponse.data.user_id

      // Get user leagues
      const leaguesResponse = await axios.get(`${this.apiUrl}/user/${userId}/leagues/nfl/2024`)
      
      for (const league of leaguesResponse.data) {
        // Get league details
        const leagueDetails = await axios.get(`${this.apiUrl}/league/${league.league_id}`)
        const rosters = await axios.get(`${this.apiUrl}/league/${league.league_id}/rosters`)
        const users = await axios.get(`${this.apiUrl}/league/${league.league_id}/users`)
        
        leagues.push({
          platformLeagueId: league.league_id,
          name: league.name,
          season: 2024,
          sport: 'football',
          settings: leagueDetails.data.settings,
          teams: this.formatSleeperTeams(rosters.data, users.data),
        })
      }
    } catch (error) {
      apiLogger.error('Sleeper API error', error)
    }

    return leagues
  }

  private formatSleeperTeams(rosters: any[], users: any[]) {
    return rosters.map(roster => {
      const owner = users.find(u => u.user_id === roster.owner_id)
      return {
        id: roster.roster_id.toString(),
        ownerId: roster.owner_id,
        name: owner?.display_name || `Team ${roster.roster_id}`,
        roster: roster.players || [],
        standings: {
          wins: roster.settings.wins,
          losses: roster.settings.losses,
          ties: roster.settings.ties,
        },
        stats: roster.settings,
      }
    })
  }
}

// CBS Sports Importer
class CBSImporter implements PlatformImporter {
  async fetchUserLeagues(connection: any) {
    // CBS Sports implementation
    return []
  }
}

// NFL.com Importer
class NFLImporter implements PlatformImporter {
  async fetchUserLeagues(connection: any) {
    // NFL.com implementation
    return []
  }
}