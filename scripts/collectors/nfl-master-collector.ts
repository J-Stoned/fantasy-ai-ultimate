/**
 * 🏈 NFL MASTER COLLECTOR
 * Combines ESPN, Sleeper, and other sources for comprehensive NFL data
 */

import { BaseCollector, CollectorConfig } from './base-collector';
import axios from 'axios';
import chalk from 'chalk';

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team: string | null;
  position: string;
  number: string | null;
  height: string | null;
  weight: string | null;
  birth_date: string | null;
  status: string;
  espn_id: string | null;
  yahoo_id: string | null;
  years_exp: number;
  college: string | null;
}

interface ESPNGame {
  id: string;
  date: string;
  status: {
    type: {
      completed: boolean;
    };
  };
  competitions: Array<{
    competitors: Array<{
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
      };
      homeAway: string;
      score: string;
    }>;
    venue?: {
      fullName: string;
    };
  }>;
}

export class NFLMasterCollector extends BaseCollector {
  private sleeperPlayers: Map<string, SleeperPlayer> = new Map();
  private teamIdMap: Map<string, number> = new Map(); // abbreviation -> id
  
  constructor(config?: CollectorConfig) {
    super(config);
    console.log(chalk.blue('🏈 NFL Master Collector initialized'));
  }
  
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🏈 NFL MASTER COLLECTION STARTING\n'));
    
    try {
      // Phase 1: Load team mappings
      await this.loadTeamMappings();
      
      // Phase 2: Collect all players from Sleeper
      await this.collectSleeperPlayers();
      
      // Phase 3: Collect recent games from ESPN
      await this.collectESPNGames();
      
      // Phase 4: Collect game stats
      await this.collectGameStats();
      
      this.printStats();
    } catch (error) {
      console.error(chalk.red('Collection failed:'), error);
    } finally {
      this.cleanup();
    }
  }
  
  /**
   * Load team ID mappings from database
   */
  private async loadTeamMappings(): Promise<void> {
    console.log(chalk.yellow('Loading team mappings...'));
    
    const { data: teams } = await this.supabase
      .from('teams')
      .select('id, abbreviation')
      .eq('sport', 'football');
    
    if (teams) {
      teams.forEach(team => {
        if (team.abbreviation) {
          this.teamIdMap.set(team.abbreviation, team.id);
        }
      });
      console.log(chalk.green(`✓ Loaded ${teams.length} team mappings`));
    }
  }
  
  /**
   * Collect all NFL players from Sleeper API
   */
  private async collectSleeperPlayers(): Promise<void> {
    console.log(chalk.yellow('\n📥 Collecting NFL players from Sleeper...'));
    
    const response = await this.retryableApiCall(async () => {
      return await axios.get<Record<string, SleeperPlayer>>(
        'https://api.sleeper.app/v1/players/nfl'
      );
    });
    
    if (!response?.data) {
      console.error(chalk.red('Failed to fetch Sleeper players'));
      return;
    }
    
    const players = Object.values(response.data);
    console.log(chalk.cyan(`Found ${players.length} total players`));
    
    // Filter to active and recent players
    const relevantPlayers = players.filter(p => 
      p.status === 'Active' || 
      p.status === 'Inactive' || 
      (p.years_exp && p.years_exp > 0)
    );
    
    console.log(chalk.cyan(`Processing ${relevantPlayers.length} relevant players...`));
    
    // Process in batches
    const batches = this.chunkArray(relevantPlayers, 500);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(chalk.gray(`  Batch ${i + 1}/${batches.length}...`));
      
      await Promise.all(
        batches[i].map(player => 
          this.rateLimiter(() => this.processSleeperPlayer(player))
        )
      );
    }
    
    console.log(chalk.green(`✓ Processed ${this.stats.playersCreated} players`));
  }
  
  /**
   * Process individual Sleeper player
   */
  private async processSleeperPlayer(player: SleeperPlayer): Promise<void> {
    try {
      // Generate photo URL if ESPN ID exists
      const photoUrl = player.espn_id 
        ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id}.png&w=350&h=254`
        : null;
      
      const playerId = await this.upsertPlayer({
        external_id: `sleeper_${player.player_id}`,
        firstname: player.first_name,
        lastname: player.last_name,
        name: player.full_name,
        sport: 'football',
        sport_id: 'nfl',
        position: player.position ? [player.position] : [],
        jersey_number: player.number ? parseInt(player.number) : undefined,
        heightinches: player.height ? parseInt(player.height) : undefined,
        weightlbs: player.weight ? parseInt(player.weight) : undefined,
        birthdate: player.birth_date || undefined,
        photo_url: photoUrl || undefined,
        team: player.team || undefined,
        team_abbreviation: player.team || undefined,
        status: player.status,
        college: player.college || undefined,
        metadata: {
          espn_id: player.espn_id,
          yahoo_id: player.yahoo_id,
          years_exp: player.years_exp
        }
      });
      
      if (playerId) {
        this.sleeperPlayers.set(player.player_id, player);
      }
    } catch (error) {
      console.error(`Error processing player ${player.full_name}:`, error);
    }
  }
  
  /**
   * Collect recent NFL games from ESPN
   */
  private async collectESPNGames(): Promise<void> {
    console.log(chalk.yellow('\n📅 Collecting NFL games from ESPN...'));
    
    const currentYear = new Date().getFullYear();
    const seasons = [currentYear - 1, currentYear];
    const weeks = Array.from({ length: 18 }, (_, i) => i + 1); // Regular season weeks
    
    for (const season of seasons) {
      for (const week of weeks) {
        await this.collectWeekGames(season, week);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.stats.gamesCreated} games`));
  }
  
  /**
   * Collect games for a specific week
   */
  private async collectWeekGames(season: number, week: number): Promise<void> {
    const response = await this.retryableApiCall(async () => {
      return await axios.get<{ events: ESPNGame[] }>(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`,
        {
          params: {
            dates: season,
            seasontype: 2, // Regular season
            week: week
          }
        }
      );
    });
    
    if (!response?.data?.events) return;
    
    const games = response.data.events.filter(game => 
      game.status.type.completed
    );
    
    if (games.length === 0) return;
    
    console.log(chalk.gray(`  Season ${season} Week ${week}: ${games.length} games`));
    
    for (const game of games) {
      await this.processESPNGame(game);
    }
  }
  
  /**
   * Process individual ESPN game
   */
  private async processESPNGame(game: ESPNGame): Promise<void> {
    try {
      const competition = game.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) return;
      
      const gameId = await this.upsertGame({
        external_id: `espn_${game.id}`,
        sport: 'football',
        sport_id: 'nfl',
        home_team_id: this.teamIdMap.get(homeTeam.team.abbreviation),
        away_team_id: this.teamIdMap.get(awayTeam.team.abbreviation),
        start_time: new Date(game.date),
        status: 'completed',
        venue: competition.venue?.fullName,
        home_score: parseInt(homeTeam.score),
        away_score: parseInt(awayTeam.score),
        league: 'NFL',
        metadata: {
          espn_id: game.id,
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName
        }
      });
      
      if (gameId) {
        // Store for later stats collection
        this.cache.set(`game_${game.id}`, {
          gameId,
          espnId: game.id,
          homeTeamId: this.teamIdMap.get(homeTeam.team.abbreviation),
          awayTeamId: this.teamIdMap.get(awayTeam.team.abbreviation)
        }, 60); // Cache for 1 hour
      }
    } catch (error) {
      console.error(`Error processing game ${game.id}:`, error);
    }
  }
  
  /**
   * Collect detailed game stats
   */
  private async collectGameStats(): Promise<void> {
    console.log(chalk.yellow('\n📊 Collecting game statistics...'));
    
    const cachedGames = Array.from(this.cache['cache'].entries())
      .filter(([key]) => key.startsWith('game_'))
      .map(([, value]) => value.data);
    
    console.log(chalk.cyan(`Processing stats for ${cachedGames.length} games...`));
    
    const batches = this.chunkArray(cachedGames, 10);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(chalk.gray(`  Batch ${i + 1}/${batches.length}...`));
      
      await Promise.all(
        batches[i].map(game => 
          this.rateLimiter(() => this.collectGameBoxScore(game))
        )
      );
    }
    
    console.log(chalk.green(`✓ Created ${this.stats.gameLogsCreated} player game logs`));
  }
  
  /**
   * Collect box score for a specific game
   */
  private async collectGameBoxScore(gameData: any): Promise<void> {
    const response = await this.retryableApiCall(async () => {
      return await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
        {
          params: { event: gameData.espnId }
        }
      );
    });
    
    if (!response?.data?.boxscore?.players) return;
    
    for (const teamData of response.data.boxscore.players) {
      await this.processTeamStats(
        teamData,
        gameData.gameId,
        teamData.team.id === gameData.homeTeamId
      );
    }
  }
  
  /**
   * Process stats for a team
   */
  private async processTeamStats(
    teamData: any,
    gameId: number,
    isHome: boolean
  ): Promise<void> {
    const teamId = this.teamIdMap.get(teamData.team.abbreviation);
    
    for (const category of teamData.statistics || []) {
      for (const player of category.athletes || []) {
        await this.processPlayerStats(
          player,
          gameId,
          teamId,
          isHome,
          category.name
        );
      }
    }
  }
  
  /**
   * Process individual player stats
   */
  private async processPlayerStats(
    playerData: any,
    gameId: number,
    teamId: number | undefined,
    isHome: boolean,
    category: string
  ): Promise<void> {
    try {
      const athlete = playerData.athlete;
      if (!athlete) return;
      
      // Get or create player
      const playerId = await this.upsertPlayer({
        external_id: `espn_${athlete.id}`,
        firstname: athlete.firstName || athlete.displayName.split(' ')[0],
        lastname: athlete.lastName || athlete.displayName.split(' ').slice(1).join(' '),
        name: athlete.displayName,
        sport: 'football',
        sport_id: 'nfl',
        position: athlete.position ? [athlete.position.abbreviation] : [],
        jersey_number: athlete.jersey ? parseInt(athlete.jersey) : undefined,
        photo_url: `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athlete.id}.png&w=350&h=254`,
        team: teamData.team.displayName,
        team_abbreviation: teamData.team.abbreviation,
        metadata: {
          espn_id: athlete.id
        }
      });
      
      if (!playerId) return;
      
      // Parse stats based on category
      const stats = this.parseNFLStats(playerData.stats, category);
      const fantasyPoints = this.calculateNFLFantasyPoints(stats);
      
      // Only create log if player had meaningful stats
      if (fantasyPoints > 0 || this.hasSignificantStats(stats)) {
        await this.createGameLog({
          player_id: playerId,
          game_id: gameId,
          team_id: teamId,
          game_date: new Date(),
          opponent_id: undefined, // Would need to look up
          is_home: isHome,
          stats: stats,
          fantasy_points: fantasyPoints
        });
      }
    } catch (error) {
      console.error('Error processing player stats:', error);
    }
  }
  
  /**
   * Parse NFL stats from ESPN format
   */
  private parseNFLStats(statsArray: string[], category: string): any {
    const stats: any = { category };
    
    if (!statsArray || statsArray.length === 0) return stats;
    
    switch (category) {
      case 'passing':
        const [compAtt, yards, avg, td, int, sacks, qbr, rtg] = statsArray;
        if (compAtt && compAtt.includes('/')) {
          const [comp, att] = compAtt.split('/').map(Number);
          stats.completions = comp || 0;
          stats.attempts = att || 0;
        }
        stats.passing_yards = parseInt(yards) || 0;
        stats.passing_tds = parseInt(td) || 0;
        stats.interceptions = parseInt(int) || 0;
        stats.sacks_taken = parseInt(sacks?.split('-')[0]) || 0;
        stats.qb_rating = parseFloat(rtg) || 0;
        break;
        
      case 'rushing':
        stats.carries = parseInt(statsArray[0]) || 0;
        stats.rushing_yards = parseInt(statsArray[1]) || 0;
        stats.yards_per_carry = parseFloat(statsArray[2]) || 0;
        stats.rushing_tds = parseInt(statsArray[3]) || 0;
        stats.long_rush = parseInt(statsArray[4]) || 0;
        break;
        
      case 'receiving':
        stats.receptions = parseInt(statsArray[0]) || 0;
        stats.receiving_yards = parseInt(statsArray[1]) || 0;
        stats.yards_per_reception = parseFloat(statsArray[2]) || 0;
        stats.receiving_tds = parseInt(statsArray[3]) || 0;
        stats.long_reception = parseInt(statsArray[4]) || 0;
        stats.targets = parseInt(statsArray[5]) || stats.receptions;
        break;
        
      case 'fumbles':
        stats.fumbles = parseInt(statsArray[0]) || 0;
        stats.fumbles_lost = parseInt(statsArray[1]) || 0;
        stats.fumbles_recovered = parseInt(statsArray[2]) || 0;
        break;
        
      case 'defensive':
        stats.total_tackles = parseInt(statsArray[0]) || 0;
        stats.solo_tackles = parseInt(statsArray[1]) || 0;
        stats.sacks = parseFloat(statsArray[2]) || 0;
        stats.tackles_for_loss = parseFloat(statsArray[3]) || 0;
        stats.pass_deflections = parseInt(statsArray[4]) || 0;
        stats.qb_hits = parseInt(statsArray[5]) || 0;
        stats.defensive_tds = parseInt(statsArray[6]) || 0;
        break;
        
      case 'interceptions':
        stats.interceptions_caught = parseInt(statsArray[0]) || 0;
        stats.interception_yards = parseInt(statsArray[1]) || 0;
        stats.interception_tds = parseInt(statsArray[2]) || 0;
        break;
        
      case 'kickReturns':
      case 'puntReturns':
        const returnType = category === 'kickReturns' ? 'kick' : 'punt';
        stats[`${returnType}_returns`] = parseInt(statsArray[0]) || 0;
        stats[`${returnType}_return_yards`] = parseInt(statsArray[1]) || 0;
        stats[`${returnType}_return_avg`] = parseFloat(statsArray[2]) || 0;
        stats[`${returnType}_return_tds`] = parseInt(statsArray[3]) || 0;
        stats[`${returnType}_return_long`] = parseInt(statsArray[4]) || 0;
        break;
        
      case 'kicking':
        const fgParts = statsArray[0]?.split('/') || ['0', '0'];
        stats.field_goals_made = parseInt(fgParts[0]) || 0;
        stats.field_goals_attempted = parseInt(fgParts[1]) || 0;
        stats.field_goal_pct = parseFloat(statsArray[1]) || 0;
        stats.long_field_goal = parseInt(statsArray[2]) || 0;
        const xpParts = statsArray[3]?.split('/') || ['0', '0'];
        stats.extra_points_made = parseInt(xpParts[0]) || 0;
        stats.extra_points_attempted = parseInt(xpParts[1]) || 0;
        stats.total_points = parseInt(statsArray[5]) || 0;
        break;
        
      case 'punting':
        stats.punts = parseInt(statsArray[0]) || 0;
        stats.punt_yards = parseInt(statsArray[1]) || 0;
        stats.punt_avg = parseFloat(statsArray[2]) || 0;
        stats.punt_touchbacks = parseInt(statsArray[3]) || 0;
        stats.punts_inside_20 = parseInt(statsArray[4]) || 0;
        stats.long_punt = parseInt(statsArray[5]) || 0;
        break;
    }
    
    return stats;
  }
  
  /**
   * Calculate fantasy points for NFL (standard PPR scoring)
   */
  private calculateNFLFantasyPoints(stats: any): number {
    let points = 0;
    
    // Passing
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_tds || 0) * 4;
    points += (stats.interceptions || 0) * -2;
    
    // Rushing
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_tds || 0) * 6;
    
    // Receiving
    points += (stats.receptions || 0) * 1; // PPR
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_tds || 0) * 6;
    
    // Misc
    points += (stats.fumbles_lost || 0) * -2;
    points += (stats.kick_return_tds || 0) * 6;
    points += (stats.punt_return_tds || 0) * 6;
    
    // Defense/IDP
    points += (stats.sacks || 0) * 1;
    points += (stats.interceptions_caught || 0) * 2;
    points += (stats.fumbles_recovered || 0) * 2;
    points += (stats.defensive_tds || 0) * 6;
    points += (stats.interception_tds || 0) * 6;
    
    // Kicking
    points += (stats.extra_points_made || 0) * 1;
    points += (stats.field_goals_made || 0) * 3; // Simplified, usually distance-based
    
    return Math.round(points * 100) / 100;
  }
  
  /**
   * Check if stats are significant enough to store
   */
  private hasSignificantStats(stats: any): boolean {
    const significantStats = [
      'completions', 'carries', 'receptions', 'total_tackles',
      'field_goals_made', 'punts', 'kick_returns', 'punt_returns'
    ];
    
    return significantStats.some(stat => (stats[stat] || 0) > 0);
  }
}