import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import { z } from 'zod'
import { defaultLogger } from '../../utils/logger'

const prisma = new PrismaClient()

// Player data schema for validation
const PlayerDataSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  position: z.array(z.string()).optional(),
  jerseyNumber: z.string().optional(),
  team: z.string().optional(),
  league: z.string().optional(),
})

export class PlayerDataCollector {
  private sources: Map<string, DataSource>

  constructor() {
    this.sources = new Map([
      ['balldontlie', new BallDontLieSource()],
      ['sportsradar', new SportsRadarSource()],
      ['espn', new ESPNSource()],
      ['ncaa', new NCAASource()],
      ['maxpreps', new MaxPrepsSource()],
    ])
  }

  /**
   * Collect ALL players from ALL leagues and levels
   */
  async collectAllPlayers() {
    defaultLogger.info('Starting comprehensive player data collection...')
    
    const results = {
      professional: await this.collectProfessionalPlayers(),
      college: await this.collectCollegePlayers(),
      highSchool: await this.collectHighSchoolPlayers(),
      international: await this.collectInternationalPlayers(),
      youth: await this.collectYouthPlayers(),
    }

    defaultLogger.info('Player collection complete', {
      professional: results.professional.length,
      college: results.college.length,
      highSchool: results.highSchool.length,
      international: results.international.length,
      youth: results.youth.length,
      total: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    })

    return results
  }

  /**
   * Collect professional players (NFL, NBA, MLB, NHL, MLS, etc.)
   */
  private async collectProfessionalPlayers() {
    const players: any[] = []
    
    // NBA Players
    try {
      const nbaPlayers = await this.sources.get('balldontlie')?.fetchNBAPlayers()
      players.push(...(nbaPlayers || []))
    } catch (error) {
      defaultLogger.error('Error collecting NBA players', { error })
    }

    // NFL Players
    try {
      const nflPlayers = await this.sources.get('sportsradar')?.fetchNFLPlayers()
      players.push(...(nflPlayers || []))
    } catch (error) {
      defaultLogger.error('Error collecting NFL players', { error })
    }

    // MLB Players
    try {
      const mlbPlayers = await this.sources.get('sportsradar')?.fetchMLBPlayers()
      players.push(...(mlbPlayers || []))
    } catch (error) {
      defaultLogger.error('Error collecting MLB players', { error })
    }

    // NHL Players
    try {
      const nhlPlayers = await this.sources.get('sportsradar')?.fetchNHLPlayers()
      players.push(...(nhlPlayers || []))
    } catch (error) {
      defaultLogger.error('Error collecting NHL players', { error })
    }

    // Save to database
    await this.savePlayersToDB(players, 'professional')
    return players
  }

  /**
   * Collect college players (NCAA Division I, II, III)
   */
  private async collectCollegePlayers() {
    const players: any[] = []
    
    try {
      const ncaaPlayers = await this.sources.get('ncaa')?.fetchAllDivisionPlayers()
      players.push(...(ncaaPlayers || []))
    } catch (error) {
      defaultLogger.error('Error collecting NCAA players', { error })
    }

    await this.savePlayersToDB(players, 'college')
    return players
  }

  /**
   * Collect high school players
   */
  private async collectHighSchoolPlayers() {
    const players: any[] = []
    
    try {
      const hsPlayers = await this.sources.get('maxpreps')?.fetchHighSchoolPlayers()
      players.push(...(hsPlayers || []))
    } catch (error) {
      defaultLogger.error('Error collecting high school players', { error })
    }

    await this.savePlayersToDB(players, 'high_school')
    return players
  }

  /**
   * Collect international players
   */
  private async collectInternationalPlayers() {
    const players: any[] = []
    
    // Soccer players from major leagues
    const soccerLeagues = [
      'premier-league', 'la-liga', 'bundesliga', 
      'serie-a', 'ligue-1', 'champions-league'
    ]
    
    for (const league of soccerLeagues) {
      try {
        const leaguePlayers = await this.fetchSoccerPlayers(league)
        players.push(...leaguePlayers)
      } catch (error) {
        defaultLogger.error('Error collecting players', { league, error })
      }
    }

    await this.savePlayersToDB(players, 'international')
    return players
  }

  /**
   * Collect youth players (AAU, Pop Warner, etc.)
   */
  private async collectYouthPlayers() {
    const players: any[] = []
    
    // This would connect to youth sports databases
    // For now, returning empty array as these require specific partnerships
    
    await this.savePlayersToDB(players, 'youth')
    return players
  }

  /**
   * Save players to database with batch operations - NFL Sunday optimized!
   */
  private async savePlayersToDB(players: any[], level: string) {
    defaultLogger.info('Saving players to database', { count: players.length, level })
    
    if (players.length === 0) return;

    const batchSize = 1000; // Process in chunks to avoid memory issues
    const chunks = [];
    
    for (let i = 0; i < players.length; i += batchSize) {
      chunks.push(players.slice(i, i + batchSize));
    }

    for (const chunk of chunks) {
      try {
        // Step 1: Get all existing players in ONE query
        const playerIdentifiers = chunk.map(p => ({
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth || null
        }));

        const existingPlayers = await prisma.player.findMany({
          where: {
            OR: playerIdentifiers.map(id => ({
              AND: [
                { firstName: id.firstName },
                { lastName: id.lastName },
                id.dateOfBirth ? { dateOfBirth: new Date(id.dateOfBirth) } : {}
              ]
            }))
          }
        });

        // Create lookup map for existing players
        const existingMap = new Map(
          existingPlayers.map(p => [
            `${p.firstName}-${p.lastName}-${p.dateOfBirth?.toISOString() || 'null'}`,
            p
          ])
        );

        // Step 2: Separate new players and updates
        const newPlayers = [];
        const updates = [];

        for (const playerData of chunk) {
          const key = `${playerData.firstName}-${playerData.lastName}-${playerData.dateOfBirth || 'null'}`;
          const existing = existingMap.get(key);

          if (!existing) {
            newPlayers.push({
              firstName: playerData.firstName,
              lastName: playerData.lastName,
              dateOfBirth: playerData.dateOfBirth ? new Date(playerData.dateOfBirth) : null,
              heightInches: playerData.height,
              weightLbs: playerData.weight,
              position: playerData.position || [],
              jerseyNumber: playerData.jerseyNumber,
              status: 'active',
              alternateNames: [],
            });
          } else {
            // Only update if data has changed
            if (
              playerData.height !== existing.heightInches ||
              playerData.weight !== existing.weightLbs ||
              JSON.stringify(playerData.position) !== JSON.stringify(existing.position) ||
              playerData.jerseyNumber !== existing.jerseyNumber
            ) {
              updates.push({
                id: existing.id,
                data: {
                  heightInches: playerData.height || existing.heightInches,
                  weightLbs: playerData.weight || existing.weightLbs,
                  position: playerData.position || existing.position,
                  jerseyNumber: playerData.jerseyNumber || existing.jerseyNumber,
                }
              });
            }
          }
        }

        // Step 3: Batch insert new players
        if (newPlayers.length > 0) {
          await prisma.player.createMany({
            data: newPlayers,
            skipDuplicates: true, // Extra safety
          });
          defaultLogger.info('Batch inserted new players', { count: newPlayers.length, level });
        }

        // Step 4: Batch update existing players using transaction
        if (updates.length > 0) {
          await prisma.$transaction(
            updates.map(update => 
              prisma.player.update({
                where: { id: update.id },
                data: update.data
              })
            )
          );
          defaultLogger.info('Batch updated existing players', { count: updates.length, level });
        }

      } catch (error) {
        defaultLogger.error('Error in batch save operation', { error, level });
        // Don't throw - continue with next batch
      }
    }

    defaultLogger.info('Completed saving players', { 
      total: players.length, 
      level,
      performance: 'Optimized for NFL Sunday load' 
    });
  }

  private async fetchSoccerPlayers(league: string) {
    // Implementation for soccer player fetching
    return []
  }
}

// Data source interfaces
interface DataSource {
  fetchNBAPlayers?(): Promise<any[]>
  fetchNFLPlayers?(): Promise<any[]>
  fetchMLBPlayers?(): Promise<any[]>
  fetchNHLPlayers?(): Promise<any[]>
  fetchAllDivisionPlayers?(): Promise<any[]>
  fetchHighSchoolPlayers?(): Promise<any[]>
}

// BallDontLie API source
class BallDontLieSource implements DataSource {
  private apiUrl = 'https://www.balldontlie.io/api/v1'

  async fetchNBAPlayers() {
    const players: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const response = await axios.get(`${this.apiUrl}/players`, {
          params: { page, per_page: 100 }
        })
        
        players.push(...response.data.data)
        hasMore = response.data.meta.next_page !== null
        page++
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error('BallDontLie API error:', error)
        hasMore = false
      }
    }

    return players.map(p => ({
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position ? [p.position] : [],
      height: this.parseHeight(p.height_feet, p.height_inches),
      weight: p.weight_pounds,
      team: p.team?.full_name,
    }))
  }

  private parseHeight(feet: number | null, inches: number | null): number | null {
    if (!feet) return null
    return (feet * 12) + (inches || 0)
  }
}

// Sports Radar source (requires API key)
class SportsRadarSource implements DataSource {
  private apiKey = process.env.SPORTRADAR_API_KEY

  async fetchNFLPlayers() {
    if (!this.apiKey) return []
    // Implementation with Sports Radar API
    return []
  }

  async fetchMLBPlayers() {
    if (!this.apiKey) return []
    // Implementation with Sports Radar API
    return []
  }

  async fetchNHLPlayers() {
    if (!this.apiKey) return []
    // Implementation with Sports Radar API
    return []
  }
}

// ESPN source
class ESPNSource implements DataSource {
  // ESPN API implementation
}

// NCAA source
class NCAASource implements DataSource {
  async fetchAllDivisionPlayers() {
    // NCAA data collection implementation
    return []
  }
}

// MaxPreps source for high school
class MaxPrepsSource implements DataSource {
  async fetchHighSchoolPlayers() {
    // MaxPreps scraping implementation
    return []
  }
}