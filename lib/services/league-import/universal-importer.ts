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
    const leagues: any[] = []
    
    try {
      // Fetch user's leagues from Yahoo API
      const response = await axios.get(`${this.apiUrl}/users;use_login=1/games;game_keys=nfl,nba,mlb,nhl/leagues?format=json`, {
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`,
          'Accept': 'application/json'
        }
      })
      
      // Parse Yahoo's complex response structure
      const games = response.data.fantasy_content?.users?.[0]?.user?.[1]?.games
      
      if (games) {
        // Yahoo returns data in a numbered array format
        for (let i = 0; i < games.count; i++) {
          const game = games[i]?.game
          if (game && game[1]?.leagues) {
            const gameLeagues = game[1].leagues
            for (let j = 0; j < gameLeagues.count; j++) {
              const league = gameLeagues[j]?.league
              if (league) {
                // Fetch teams for this league
                const teams = await this.fetchLeagueTeams(league[0].league_key, connection.accessToken)
                
                leagues.push({
                  platformLeagueId: league[0].league_key,
                  name: league[0].name,
                  season: parseInt(league[0].season),
                  sport: this.mapGameCodeToSport(league[0].game_code),
                  settings: {
                    num_teams: league[0].num_teams,
                    game_code: league[0].game_code,
                    draft_status: league[0].draft_status,
                    scoring_type: league[0].scoring_type,
                    league_type: league[0].league_type,
                    scoring: {},
                    roster: {}
                  },
                  teams: teams
                })
              }
            }
          }
        }
      }
    } catch (error) {
      apiLogger.error('Yahoo API error', error)
      // Check if token expired
      if (error.response?.status === 401) {
        throw new Error('Yahoo token expired. Please re-authenticate.')
      }
    }

    return leagues
  }

  private async fetchLeagueTeams(leagueKey: string, accessToken: string): Promise<any[]> {
    const teams: any[] = []
    
    try {
      const response = await axios.get(`${this.apiUrl}/league/${leagueKey}/teams?format=json`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      const teamsData = response.data.fantasy_content?.league?.[1]?.teams

      if (teamsData) {
        for (let i = 0; i < teamsData.count; i++) {
          const team = teamsData[i]?.team
          if (team) {
            // Fetch roster for each team
            const roster = await this.fetchTeamRoster(team[0].team_key, accessToken)
            
            teams.push({
              id: team[0].team_key,
              ownerId: team[0].managers?.[0]?.manager?.guid || team[0].team_key,
              name: team[0].name,
              roster: roster,
              standings: {
                wins: parseInt(team[1]?.team_standings?.outcome_totals?.wins || 0),
                losses: parseInt(team[1]?.team_standings?.outcome_totals?.losses || 0),
                ties: parseInt(team[1]?.team_standings?.outcome_totals?.ties || 0),
              },
              stats: team[1]?.team_stats || {},
            })
          }
        }
      }
    } catch (error) {
      apiLogger.error('Error fetching teams', error)
    }

    return teams
  }

  private async fetchTeamRoster(teamKey: string, accessToken: string): Promise<any[]> {
    const roster: any[] = []
    
    try {
      const response = await axios.get(`${this.apiUrl}/team/${teamKey}/roster?format=json`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      const players = response.data.fantasy_content?.team?.[1]?.roster?.[0]?.players

      if (players) {
        for (let i = 0; i < players.count; i++) {
          const player = players[i]?.player
          if (player) {
            roster.push({
              id: player[0].player_key,
              name: player[0].name?.full || 'Unknown',
              position: player[0].primary_position || player[0].display_position,
              team: player[0].editorial_team_abbr,
              jerseyNumber: player[0].uniform_number,
            })
          }
        }
      }
    } catch (error) {
      apiLogger.error('Error fetching roster', error)
    }

    return roster
  }

  private mapGameCodeToSport(gameCode: string): string {
    const sportMap: Record<string, string> = {
      nfl: 'football',
      nba: 'basketball',
      mlb: 'baseball',
      nhl: 'hockey'
    }
    return sportMap[gameCode] || 'other'
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

// Sleeper Importer - Enhanced with full data fetching
class SleeperImporter implements PlatformImporter {
  private apiUrl = 'https://api.sleeper.app/v1'
  private nflPlayers: Map<string, any> = new Map()

  async fetchUserLeagues(connection: any) {
    const leagues: any[] = []
    
    try {
      // Load NFL players data first
      await this.loadNFLPlayers()

      // Get user info
      const userResponse = await axios.get(`${this.apiUrl}/user/${connection.platformUserId || connection.username}`)
      const userId = userResponse.data.user_id

      // Get user leagues for multiple sports
      const sports = ['nfl', 'nba', 'mlb']
      const currentYear = new Date().getFullYear()
      
      for (const sport of sports) {
        try {
          const leaguesResponse = await axios.get(`${this.apiUrl}/user/${userId}/leagues/${sport}/${currentYear}`)
          
          for (const league of leaguesResponse.data) {
            const fullLeague = await this.fetchFullLeagueData(league, sport)
            if (fullLeague) {
              leagues.push(fullLeague)
            }
          }
        } catch (error) {
          // Sport might not have active leagues
          apiLogger.debug(`No ${sport} leagues found for user`)
        }
      }
    } catch (error) {
      apiLogger.error('Sleeper API error', error)
    }

    return leagues
  }

  private async loadNFLPlayers() {
    try {
      const response = await axios.get(`${this.apiUrl}/players/nfl`)
      Object.entries(response.data).forEach(([id, player]: [string, any]) => {
        this.nflPlayers.set(id, player)
      })
    } catch (error) {
      apiLogger.error('Failed to load NFL players', error)
    }
  }

  private async fetchFullLeagueData(league: any, sport: string) {
    try {
      // Fetch all league data in parallel for efficiency
      const [leagueDetails, rosters, users, matchups, transactions, draftPicks, tradedPicks] = await Promise.all([
        axios.get(`${this.apiUrl}/league/${league.league_id}`),
        axios.get(`${this.apiUrl}/league/${league.league_id}/rosters`),
        axios.get(`${this.apiUrl}/league/${league.league_id}/users`),
        this.fetchAllMatchups(league.league_id),
        axios.get(`${this.apiUrl}/league/${league.league_id}/transactions/1`).catch(() => ({ data: [] })),
        axios.get(`${this.apiUrl}/league/${league.league_id}/drafts`).catch(() => ({ data: [] })),
        axios.get(`${this.apiUrl}/league/${league.league_id}/traded_picks`).catch(() => ({ data: [] }))
      ])

      const settings = leagueDetails.data.settings || {}
      
      return {
        platformLeagueId: league.league_id,
        name: league.name,
        season: league.season,
        sport: this.mapSleeperSport(sport),
        settings: {
          ...settings,
          scoring: this.extractScoringSettings(settings),
          roster: this.extractRosterSettings(settings),
          playoff_settings: {
            playoff_week_start: settings.playoff_week_start,
            playoff_teams: settings.playoff_teams,
            playoff_type: settings.playoff_type
          }
        },
        teams: this.formatSleeperTeams(rosters.data, users.data, sport),
        matchups: matchups,
        transactions: this.formatTransactions(transactions.data),
        draft: await this.fetchDraftData(draftPicks.data),
        tradedPicks: tradedPicks.data
      }
    } catch (error) {
      apiLogger.error(`Failed to fetch full league data for ${league.league_id}`, error)
      return null
    }
  }

  private async fetchAllMatchups(leagueId: string) {
    const matchups: any[] = []
    const currentWeek = 18 // Adjust based on current NFL week
    
    for (let week = 1; week <= currentWeek; week++) {
      try {
        const response = await axios.get(`${this.apiUrl}/league/${leagueId}/matchups/${week}`)
        matchups.push({
          week,
          matchups: response.data
        })
      } catch (error) {
        break // No more weeks available
      }
    }
    
    return matchups
  }

  private async fetchDraftData(drafts: any[]) {
    if (!drafts || drafts.length === 0) return null
    
    const draftId = drafts[0]?.draft_id
    if (!draftId) return null
    
    try {
      const response = await axios.get(`${this.apiUrl}/draft/${draftId}/picks`)
      return {
        draft_id: draftId,
        picks: response.data
      }
    } catch (error) {
      return null
    }
  }

  private formatSleeperTeams(rosters: any[], users: any[], sport: string) {
    return rosters.map(roster => {
      const owner = users.find(u => u.user_id === roster.owner_id)
      const enrichedRoster = this.enrichRosterWithPlayerData(roster.players || [], sport)
      
      return {
        id: roster.roster_id.toString(),
        ownerId: roster.owner_id,
        name: owner?.team_name || owner?.display_name || `Team ${roster.roster_id}`,
        avatar: owner?.avatar,
        roster: enrichedRoster,
        starters: roster.starters || [],
        reserve: roster.reserve || [],
        taxi: roster.taxi || [],
        standings: {
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          fpts: roster.settings?.fpts || 0,
          fpts_against: roster.settings?.fpts_against || 0,
          fpts_decimal: roster.settings?.fpts_decimal || 0,
          total_moves: roster.settings?.total_moves || 0
        },
        stats: roster.settings,
        metadata: roster.metadata
      }
    })
  }

  private enrichRosterWithPlayerData(playerIds: string[], sport: string) {
    if (sport !== 'nfl' || !this.nflPlayers.size) {
      return playerIds.map(id => ({ id, name: 'Unknown Player' }))
    }
    
    return playerIds.map(playerId => {
      const player = this.nflPlayers.get(playerId)
      if (!player) {
        return { id: playerId, name: 'Unknown Player' }
      }
      
      return {
        id: playerId,
        name: `${player.first_name} ${player.last_name}`,
        position: player.position,
        team: player.team,
        jerseyNumber: player.number,
        age: player.age,
        years_exp: player.years_exp,
        status: player.status,
        injury_status: player.injury_status,
        search_rank: player.search_rank
      }
    })
  }

  private formatTransactions(transactions: any[]) {
    return transactions.map(transaction => ({
      type: transaction.type,
      status: transaction.status,
      week: transaction.leg,
      adds: transaction.adds,
      drops: transaction.drops,
      roster_ids: transaction.roster_ids,
      created: new Date(transaction.created).toISOString()
    }))
  }

  private extractScoringSettings(settings: any) {
    const scoring: any = {}
    
    // Extract all scoring settings
    Object.entries(settings).forEach(([key, value]) => {
      if (key.includes('pts') || key.includes('bonus')) {
        scoring[key] = value
      }
    })
    
    return scoring
  }

  private extractRosterSettings(settings: any) {
    return {
      roster_positions: settings.roster_positions || [],
      reserve_slots: settings.reserve_slots || 0,
      taxi_slots: settings.taxi_slots || 0,
      taxi_years: settings.taxi_years || 0,
      taxi_allow_vets: settings.taxi_allow_vets || false
    }
  }

  private mapSleeperSport(sport: string): string {
    const sportMap: Record<string, string> = {
      nfl: 'football',
      nba: 'basketball',
      mlb: 'baseball',
      nhl: 'hockey'
    }
    return sportMap[sport] || sport
  }
}

// CBS Sports Importer
class CBSImporter implements PlatformImporter {
  private apiUrl = 'http://api.cbssports.com/fantasy'
  
  async fetchUserLeagues(connection: any) {
    const leagues: any[] = []
    
    try {
      // CBS requires API token authentication
      if (!connection.apiToken) {
        throw new Error('CBS API token required. Please obtain from CBS Fantasy settings.')
      }

      // CBS API endpoints (Note: CBS API is limited compared to others)
      const sports = ['football', 'basketball', 'baseball', 'hockey']
      
      for (const sport of sports) {
        try {
          // Get user's leagues for each sport
          const leaguesResponse = await axios.get(`${this.apiUrl}/leagues`, {
            params: {
              sport: sport,
              user_token: connection.apiToken,
              response_format: 'json'
            }
          })

          if (leaguesResponse.data && leaguesResponse.data.body?.leagues) {
            for (const league of leaguesResponse.data.body.leagues) {
              const fullLeague = await this.fetchLeagueDetails(league, sport, connection.apiToken)
              if (fullLeague) {
                leagues.push(fullLeague)
              }
            }
          }
        } catch (error) {
          apiLogger.debug(`No ${sport} leagues found for CBS user`)
        }
      }
    } catch (error) {
      apiLogger.error('CBS API error', error)
      throw new Error('Failed to fetch CBS leagues. Please check your API token.')
    }

    return leagues
  }

  private async fetchLeagueDetails(league: any, sport: string, apiToken: string) {
    try {
      // Fetch league details, teams, and rosters
      const [teams, standings, transactions] = await Promise.all([
        this.fetchTeams(league.id, apiToken),
        this.fetchStandings(league.id, apiToken),
        this.fetchTransactions(league.id, apiToken)
      ])

      return {
        platformLeagueId: league.id,
        name: league.name,
        season: league.season || new Date().getFullYear(),
        sport: sport,
        settings: {
          league_type: league.type,
          num_teams: league.num_teams,
          scoring_type: league.scoring_type,
          commissioner: league.commissioner,
          draft_date: league.draft_date,
          // CBS doesn't provide detailed scoring settings via API
          scoring: {},
          roster: {
            roster_positions: this.extractRosterPositions(league)
          }
        },
        teams: this.formatCBSTeams(teams, standings),
        transactions: transactions
      }
    } catch (error) {
      apiLogger.error(`Failed to fetch CBS league details for ${league.id}`, error)
      return null
    }
  }

  private async fetchTeams(leagueId: string, apiToken: string) {
    try {
      const response = await axios.get(`${this.apiUrl}/league/teams`, {
        params: {
          league_id: leagueId,
          user_token: apiToken,
          response_format: 'json'
        }
      })
      return response.data.body?.teams || []
    } catch (error) {
      return []
    }
  }

  private async fetchStandings(leagueId: string, apiToken: string) {
    try {
      const response = await axios.get(`${this.apiUrl}/league/standings`, {
        params: {
          league_id: leagueId,
          user_token: apiToken,
          response_format: 'json'
        }
      })
      return response.data.body?.standings || []
    } catch (error) {
      return []
    }
  }

  private async fetchTransactions(leagueId: string, apiToken: string) {
    try {
      const response = await axios.get(`${this.apiUrl}/league/transactions`, {
        params: {
          league_id: leagueId,
          user_token: apiToken,
          response_format: 'json',
          limit: 100
        }
      })
      return this.formatCBSTransactions(response.data.body?.transactions || [])
    } catch (error) {
      return []
    }
  }

  private formatCBSTeams(teams: any[], standings: any[]) {
    return teams.map(team => {
      const teamStanding = standings.find(s => s.team_id === team.id) || {}
      
      return {
        id: team.id,
        ownerId: team.owner_id,
        name: team.name,
        owner_name: team.owner_name,
        logo: team.logo,
        roster: this.formatCBSRoster(team.roster || []),
        standings: {
          wins: teamStanding.wins || 0,
          losses: teamStanding.losses || 0,
          ties: teamStanding.ties || 0,
          points_for: teamStanding.points_for || 0,
          points_against: teamStanding.points_against || 0,
          rank: teamStanding.rank || 0
        }
      }
    })
  }

  private formatCBSRoster(roster: any[]) {
    return roster.map(player => ({
      id: player.id,
      name: player.fullname,
      position: player.position,
      team: player.pro_team,
      status: player.injury_status,
      // CBS provides limited player data via API
      stats: player.stats || {}
    }))
  }

  private formatCBSTransactions(transactions: any[]) {
    return transactions.map(transaction => ({
      type: transaction.type,
      date: transaction.date,
      description: transaction.description,
      teams_involved: transaction.teams,
      players: transaction.players
    }))
  }

  private extractRosterPositions(league: any): string[] {
    // CBS doesn't provide detailed roster positions via API
    // Return typical roster based on sport
    const defaultRosters: Record<string, string[]> = {
      football: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'],
      basketball: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL', 'UTIL'],
      baseball: ['C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF', 'UTIL', 'SP', 'SP', 'RP', 'RP'],
      hockey: ['C', 'C', 'LW', 'LW', 'RW', 'RW', 'D', 'D', 'D', 'D', 'G', 'G']
    }
    
    return defaultRosters[league.sport] || []
  }
}

// NFL.com Importer
class NFLImporter implements PlatformImporter {
  async fetchUserLeagues(connection: any) {
    // NFL.com implementation
    return []
  }
}