/**
 * 🎓 NCAA MASTER COLLECTOR
 * Collects college football and basketball data for draft analysis
 */

import { BaseCollector, CollectorConfig } from './base-collector';
import axios from 'axios';
import chalk from 'chalk';

interface NCAATeam {
  id: string;
  name: string;
  abbreviation: string;
  conference: string;
  mascot?: string;
  colors?: string[];
}

interface NCAAPlayer {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
  position?: {
    abbreviation: string;
    displayName: string;
  };
  height?: string;
  weight?: string;
  class?: string;
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
  draft?: {
    year?: number;
    round?: number;
    pick?: number;
    team?: string;
  };
  headshot?: {
    href: string;
  };
}

export class NCAAMasterCollector extends BaseCollector {
  private teamIdMap: Map<string, number> = new Map();
  private conferences: Map<string, NCAATeam[]> = new Map();
  
  // Top conferences and teams for comprehensive coverage
  private readonly TOP_CONFERENCES = {
    football: [
      { name: 'SEC', id: '8' },
      { name: 'Big Ten', id: '5' },
      { name: 'ACC', id: '1' },
      { name: 'Big 12', id: '4' },
      { name: 'Pac-12', id: '9' },
      { name: 'Independent', id: '18' }
    ],
    basketball: [
      { name: 'ACC', id: '2' },
      { name: 'Big East', id: '10' },
      { name: 'Big Ten', id: '7' },
      { name: 'Big 12', id: '8' },
      { name: 'SEC', id: '23' },
      { name: 'Pac-12', id: '21' }
    ]
  };
  
  // Power 5 + notable programs
  private readonly TOP_FOOTBALL_TEAMS = [
    // SEC
    { id: '333', name: 'Alabama', conf: 'SEC' },
    { id: '57', name: 'Georgia', conf: 'SEC' },
    { id: '99', name: 'LSU', conf: 'SEC' },
    { id: '61', name: 'Florida', conf: 'SEC' },
    { id: '245', name: 'Texas A&M', conf: 'SEC' },
    { id: '2633', name: 'Tennessee', conf: 'SEC' },
    { id: '2', name: 'Auburn', conf: 'SEC' },
    
    // Big Ten
    { id: '194', name: 'Ohio State', conf: 'Big Ten' },
    { id: '130', name: 'Michigan', conf: 'Big Ten' },
    { id: '213', name: 'Penn State', conf: 'Big Ten' },
    { id: '275', name: 'Wisconsin', conf: 'Big Ten' },
    { id: '135', name: 'Minnesota', conf: 'Big Ten' },
    { id: '2294', name: 'Iowa', conf: 'Big Ten' },
    
    // ACC
    { id: '228', name: 'Clemson', conf: 'ACC' },
    { id: '52', name: 'Florida State', conf: 'ACC' },
    { id: '154', name: 'Miami', conf: 'ACC' },
    { id: '152', name: 'North Carolina', conf: 'ACC' },
    
    // Big 12
    { id: '251', name: 'Texas', conf: 'Big 12' },
    { id: '201', name: 'Oklahoma', conf: 'Big 12' },
    { id: '197', name: 'Oklahoma State', conf: 'Big 12' },
    { id: '239', name: 'Baylor', conf: 'Big 12' },
    
    // Pac-12
    { id: '12', name: 'USC', conf: 'Pac-12' },
    { id: '204', name: 'Oregon', conf: 'Pac-12' },
    { id: '264', name: 'Washington', conf: 'Pac-12' },
    { id: '254', name: 'Utah', conf: 'Pac-12' },
    
    // Independent/Others
    { id: '87', name: 'Notre Dame', conf: 'Independent' },
    { id: '62', name: 'Boise State', conf: 'Mountain West' },
    { id: '2116', name: 'Cincinnati', conf: 'AAC' },
    { id: '2638', name: 'UCF', conf: 'AAC' }
  ];
  
  private readonly TOP_BASKETBALL_TEAMS = [
    // Blue Bloods
    { id: '150', name: 'Duke', conf: 'ACC' },
    { id: '96', name: 'Kentucky', conf: 'SEC' },
    { id: '153', name: 'North Carolina', conf: 'ACC' },
    { id: '2305', name: 'Kansas', conf: 'Big 12' },
    { id: '26', name: 'UCLA', conf: 'Pac-12' },
    { id: '84', name: 'Indiana', conf: 'Big Ten' },
    
    // Recent Champions & Top Programs
    { id: '222', name: 'Villanova', conf: 'Big East' },
    { id: '41', name: 'UConn', conf: 'Big East' },
    { id: '2250', name: 'Gonzaga', conf: 'WCC' },
    { id: '130', name: 'Michigan', conf: 'Big Ten' },
    { id: '127', name: 'Michigan State', conf: 'Big Ten' },
    { id: '259', name: 'Virginia', conf: 'ACC' },
    { id: '2', name: 'Auburn', conf: 'SEC' },
    { id: '239', name: 'Baylor', conf: 'Big 12' },
    
    // Other Powers
    { id: '2509', name: 'Purdue', conf: 'Big Ten' },
    { id: '194', name: 'Ohio State', conf: 'Big Ten' },
    { id: '251', name: 'Texas', conf: 'Big 12' },
    { id: '12', name: 'Arizona', conf: 'Pac-12' },
    { id: '139', name: 'Memphis', conf: 'AAC' },
    { id: '248', name: 'Houston', conf: 'AAC' }
  ];
  
  constructor(config?: CollectorConfig) {
    super(config);
    console.log(chalk.blue('🎓 NCAA Master Collector initialized'));
  }
  
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🎓 NCAA MASTER COLLECTION STARTING\n'));
    
    try {
      // Phase 1: Collect college football
      await this.collectCollegeFootball();
      
      // Phase 2: Collect college basketball
      await this.collectCollegeBasketball();
      
      // Phase 3: Collect draft data
      await this.collectDraftData();
      
      // Phase 4: Collect recent games and stats
      await this.collectRecentGames();
      
      this.printStats();
    } catch (error) {
      console.error(chalk.red('Collection failed:'), error);
    } finally {
      this.cleanup();
    }
  }
  
  /**
   * Collect college football players and teams
   */
  private async collectCollegeFootball(): Promise<void> {
    console.log(chalk.yellow('\n🏈 Collecting College Football data...\n'));
    
    const teams = this.TOP_FOOTBALL_TEAMS;
    const batches = this.chunkArray(teams, 5);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(chalk.gray(`Batch ${i + 1}/${batches.length}:`));
      
      await Promise.all(
        batches[i].map(team => 
          this.rateLimiter(() => this.collectTeamRoster(team, 'football'))
        )
      );
    }
    
    console.log(chalk.green(`✓ Collected ${this.stats.playersCreated} football players`));
  }
  
  /**
   * Collect college basketball players and teams
   */
  private async collectCollegeBasketball(): Promise<void> {
    console.log(chalk.yellow('\n🏀 Collecting College Basketball data...\n'));
    
    const teams = this.TOP_BASKETBALL_TEAMS;
    const batches = this.chunkArray(teams, 5);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(chalk.gray(`Batch ${i + 1}/${batches.length}:`));
      
      await Promise.all(
        batches[i].map(team => 
          this.rateLimiter(() => this.collectTeamRoster(team, 'basketball'))
        )
      );
    }
    
    console.log(chalk.green(`✓ Collected basketball players`));
  }
  
  /**
   * Collect roster for a specific team
   */
  private async collectTeamRoster(
    team: { id: string; name: string; conf: string },
    sport: 'football' | 'basketball'
  ): Promise<void> {
    try {
      const sportPath = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      
      const response = await this.retryableApiCall(async () => {
        return await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/${sport}/${sportPath}/teams/${team.id}/roster`
        );
      });
      
      if (!response?.data) {
        console.error(chalk.red(`Failed to fetch ${team.name} roster`));
        return;
      }
      
      const teamData = response.data;
      const athletes = teamData.athletes || [];
      
      console.log(chalk.cyan(`  ${team.name}: ${athletes.length} players`));
      
      // Process all position groups
      for (const group of athletes) {
        for (const player of group.items || []) {
          await this.processNCAAPlayer(player, sport, team, teamData.team);
        }
      }
    } catch (error) {
      console.error(`Error collecting ${team.name} roster:`, error);
    }
  }
  
  /**
   * Process individual NCAA player
   */
  private async processNCAAPlayer(
    player: NCAAPlayer,
    sport: 'football' | 'basketball',
    teamInfo: { id: string; name: string; conf: string },
    teamData: any
  ): Promise<void> {
    try {
      const sportPrefix = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      
      // Generate photo URLs
      const photoUrls = [];
      if (player.headshot?.href) {
        photoUrls.push(player.headshot.href);
      }
      photoUrls.push(
        `https://a.espncdn.com/combiner/i?img=/i/headshots/${sportPrefix}/players/full/${player.id}.png&w=350&h=254`,
        `https://a.espncdn.com/i/headshots/${sportPrefix}/players/full/${player.id}.png`
      );
      
      const playerId = await this.upsertPlayer({
        external_id: `espn_ncaa_${sport}_${player.id}`,
        firstname: player.firstName || player.displayName.split(' ')[0],
        lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
        name: player.displayName,
        sport: sport,
        sport_id: `ncaa_${sport}`,
        position: player.position ? [player.position.abbreviation] : [],
        jersey_number: player.jersey ? parseInt(player.jersey) : undefined,
        heightinches: this.parseHeight(player.height),
        weightlbs: player.weight ? parseInt(player.weight) : undefined,
        photo_url: photoUrls[0],
        team: teamInfo.name,
        team_abbreviation: teamData.abbreviation,
        college: teamInfo.name,
        metadata: {
          espn_id: player.id,
          class: player.class,
          hometown: player.birthPlace?.city,
          home_state: player.birthPlace?.state,
          conference: teamInfo.conf,
          draft_eligible_year: this.calculateDraftEligibility(player.class),
          alternate_photos: photoUrls
        }
      });
      
      if (playerId) {
        // Cache for draft analysis
        this.cache.set(`ncaa_player_${player.id}`, {
          playerId,
          name: player.displayName,
          position: player.position?.abbreviation,
          school: teamInfo.name,
          class: player.class,
          sport
        }, 60 * 24); // Cache for 24 hours
      }
    } catch (error) {
      console.error(`Error processing player ${player.displayName}:`, error);
    }
  }
  
  /**
   * Collect NFL/NBA draft data for recent years
   */
  private async collectDraftData(): Promise<void> {
    console.log(chalk.yellow('\n📋 Collecting Draft Data...\n'));
    
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear - 2, currentYear - 3];
    
    // NFL Draft
    for (const year of years) {
      await this.collectNFLDraft(year);
    }
    
    // NBA Draft
    for (const year of years) {
      await this.collectNBADraft(year);
    }
  }
  
  /**
   * Collect NFL draft data
   */
  private async collectNFLDraft(year: number): Promise<void> {
    try {
      console.log(chalk.gray(`  NFL Draft ${year}...`));
      
      const response = await this.retryableApiCall(async () => {
        return await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/draft`,
          {
            params: { year }
          }
        );
      });
      
      if (!response?.data?.picks) return;
      
      for (const pick of response.data.picks) {
        await this.processDraftPick(pick, 'nfl', year);
      }
    } catch (error) {
      console.error(`Error collecting NFL draft ${year}:`, error);
    }
  }
  
  /**
   * Collect NBA draft data
   */
  private async collectNBADraft(year: number): Promise<void> {
    try {
      console.log(chalk.gray(`  NBA Draft ${year}...`));
      
      const response = await this.retryableApiCall(async () => {
        return await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft`,
          {
            params: { year }
          }
        );
      });
      
      if (!response?.data?.picks) return;
      
      for (const pick of response.data.picks) {
        await this.processDraftPick(pick, 'nba', year);
      }
    } catch (error) {
      console.error(`Error collecting NBA draft ${year}:`, error);
    }
  }
  
  /**
   * Process draft pick data
   */
  private async processDraftPick(pick: any, league: string, year: number): Promise<void> {
    try {
      // Update player metadata with draft info
      const playerName = pick.displayName;
      const school = pick.college?.name;
      
      if (school) {
        // Try to find the player in our cache
        const cacheKey = `draft_${league}_${year}_${playerName}`;
        
        // Store draft data
        const draftData = {
          year,
          round: pick.round,
          pick: pick.overall,
          team: pick.team?.displayName,
          position: pick.position?.abbreviation,
          school,
          analysis: pick.analysis
        };
        
        this.cache.set(cacheKey, draftData, 60 * 24 * 7); // Cache for 7 days
        
        // TODO: Update player record with draft data if found
      }
    } catch (error) {
      console.error('Error processing draft pick:', error);
    }
  }
  
  /**
   * Collect recent NCAA games and stats
   */
  private async collectRecentGames(): Promise<void> {
    console.log(chalk.yellow('\n🎮 Collecting Recent Games...\n'));
    
    // Collect recent football games
    await this.collectSportGames('football', 5); // Last 5 weeks
    
    // Collect recent basketball games
    await this.collectSportGames('basketball', 10); // Last 10 days
  }
  
  /**
   * Collect games for a specific sport
   */
  private async collectSportGames(
    sport: 'football' | 'basketball',
    limit: number
  ): Promise<void> {
    try {
      const sportPath = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      
      const response = await this.retryableApiCall(async () => {
        return await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/${sport}/${sportPath}/scoreboard`,
          {
            params: {
              limit: 50,
              groups: sport === 'football' ? '80' : '50' // Top 25 games
            }
          }
        );
      });
      
      if (!response?.data?.events) return;
      
      const games = response.data.events.filter((game: any) => 
        game.status.type.completed
      ).slice(0, limit);
      
      console.log(chalk.cyan(`  ${sport}: ${games.length} recent games`));
      
      for (const game of games) {
        await this.processNCAAGame(game, sport);
      }
    } catch (error) {
      console.error(`Error collecting ${sport} games:`, error);
    }
  }
  
  /**
   * Process NCAA game
   */
  private async processNCAAGame(game: any, sport: 'football' | 'basketball'): Promise<void> {
    try {
      const competition = game.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) return;
      
      const gameId = await this.upsertGame({
        external_id: `espn_ncaa_${sport}_${game.id}`,
        sport: sport,
        sport_id: `ncaa_${sport}`,
        start_time: new Date(game.date),
        status: 'completed',
        venue: competition.venue?.fullName,
        home_score: parseInt(homeTeam.score),
        away_score: parseInt(awayTeam.score),
        league: 'NCAA',
        metadata: {
          espn_id: game.id,
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          home_rank: homeTeam.curatedRank?.current,
          away_rank: awayTeam.curatedRank?.current
        }
      });
      
      if (gameId) {
        // Collect box score stats
        await this.collectNCAABoxScore(game.id, gameId, sport);
      }
    } catch (error) {
      console.error(`Error processing NCAA game:`, error);
    }
  }
  
  /**
   * Collect box score for NCAA game
   */
  private async collectNCAABoxScore(
    espnGameId: string,
    gameId: number,
    sport: 'football' | 'basketball'
  ): Promise<void> {
    try {
      const sportPath = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      
      const response = await this.retryableApiCall(async () => {
        return await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/${sport}/${sportPath}/summary`,
          {
            params: { event: espnGameId }
          }
        );
      });
      
      if (!response?.data?.boxscore?.players) return;
      
      // Process team stats
      for (const teamData of response.data.boxscore.players) {
        await this.processNCAATeamStats(teamData, gameId, sport);
      }
    } catch (error) {
      console.error('Error collecting NCAA box score:', error);
    }
  }
  
  /**
   * Process NCAA team stats
   */
  private async processNCAATeamStats(
    teamData: any,
    gameId: number,
    sport: 'football' | 'basketball'
  ): Promise<void> {
    // Get top performers from each statistical category
    for (const category of teamData.statistics || []) {
      const topPerformers = category.athletes?.slice(0, 3) || [];
      
      for (const player of topPerformers) {
        await this.processNCAAPlayerStats(player, gameId, sport, category.name);
      }
    }
  }
  
  /**
   * Process NCAA player stats
   */
  private async processNCAAPlayerStats(
    playerData: any,
    gameId: number,
    sport: 'football' | 'basketball',
    category: string
  ): Promise<void> {
    try {
      const athlete = playerData.athlete;
      if (!athlete) return;
      
      // Look up player from cache or create
      const cachedPlayer = this.cache.get(`ncaa_player_${athlete.id}`);
      let playerId = cachedPlayer?.playerId;
      
      if (!playerId) {
        // Create player if not found
        const sportPrefix = sport === 'football' ? 'college-football' : 'mens-college-basketball';
        
        playerId = await this.upsertPlayer({
          external_id: `espn_ncaa_${sport}_${athlete.id}`,
          firstname: athlete.firstName || athlete.displayName.split(' ')[0],
          lastname: athlete.lastName || athlete.displayName.split(' ').slice(1).join(' '),
          name: athlete.displayName,
          sport: sport,
          sport_id: `ncaa_${sport}`,
          position: athlete.position ? [athlete.position.abbreviation] : [],
          jersey_number: athlete.jersey ? parseInt(athlete.jersey) : undefined,
          photo_url: `https://a.espncdn.com/combiner/i?img=/i/headshots/${sportPrefix}/players/full/${athlete.id}.png&w=350&h=254`,
          metadata: {
            espn_id: athlete.id
          }
        });
      }
      
      if (!playerId) return;
      
      // Parse stats based on sport and category
      const stats = sport === 'football' 
        ? this.parseNCAAFootballStats(playerData.stats, category)
        : this.parseNCAABasketballStats(playerData.stats, category);
      
      const fantasyPoints = sport === 'football'
        ? this.calculateNCAAFootballFantasy(stats)
        : this.calculateNCAABasketballFantasy(stats);
      
      // Create game log
      if (fantasyPoints > 0 || this.hasSignificantNCAAStats(stats)) {
        await this.createGameLog({
          player_id: playerId,
          game_id: gameId,
          game_date: new Date(),
          stats: stats,
          fantasy_points: fantasyPoints
        });
      }
    } catch (error) {
      console.error('Error processing NCAA player stats:', error);
    }
  }
  
  /**
   * Parse NCAA football stats
   */
  private parseNCAAFootballStats(statsArray: string[], category: string): any {
    // Similar to NFL parsing but with college-specific adjustments
    const stats: any = { category, level: 'college' };
    
    if (!statsArray || statsArray.length === 0) return stats;
    
    switch (category) {
      case 'passing':
        const [compAtt, yards, td, int] = statsArray;
        if (compAtt && compAtt.includes('/')) {
          const [comp, att] = compAtt.split('/').map(Number);
          stats.completions = comp || 0;
          stats.attempts = att || 0;
        }
        stats.passing_yards = parseInt(yards) || 0;
        stats.passing_tds = parseInt(td) || 0;
        stats.interceptions = parseInt(int) || 0;
        break;
        
      case 'rushing':
        stats.carries = parseInt(statsArray[0]) || 0;
        stats.rushing_yards = parseInt(statsArray[1]) || 0;
        stats.rushing_tds = parseInt(statsArray[3]) || 0;
        break;
        
      case 'receiving':
        stats.receptions = parseInt(statsArray[0]) || 0;
        stats.receiving_yards = parseInt(statsArray[1]) || 0;
        stats.receiving_tds = parseInt(statsArray[3]) || 0;
        break;
    }
    
    return stats;
  }
  
  /**
   * Parse NCAA basketball stats
   */
  private parseNCAABasketballStats(statsArray: string[], category: string): any {
    const stats: any = { category, level: 'college' };
    
    if (!statsArray || statsArray.length === 0) return stats;
    
    // Basketball has different stat categories
    if (category === 'scoring' || !category) {
      stats.points = parseInt(statsArray[0]) || 0;
      stats.rebounds = parseInt(statsArray[1]) || 0;
      stats.assists = parseInt(statsArray[2]) || 0;
      stats.steals = parseInt(statsArray[3]) || 0;
      stats.blocks = parseInt(statsArray[4]) || 0;
      stats.turnovers = parseInt(statsArray[5]) || 0;
      stats.field_goals_made = parseInt(statsArray[6]?.split('-')[0]) || 0;
      stats.field_goals_attempted = parseInt(statsArray[6]?.split('-')[1]) || 0;
      stats.three_pointers_made = parseInt(statsArray[7]?.split('-')[0]) || 0;
      stats.three_pointers_attempted = parseInt(statsArray[7]?.split('-')[1]) || 0;
      stats.free_throws_made = parseInt(statsArray[8]?.split('-')[0]) || 0;
      stats.free_throws_attempted = parseInt(statsArray[8]?.split('-')[1]) || 0;
    }
    
    return stats;
  }
  
  /**
   * Calculate fantasy points for NCAA football
   */
  private calculateNCAAFootballFantasy(stats: any): number {
    // Same as NFL scoring
    let points = 0;
    
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_tds || 0) * 4;
    points += (stats.interceptions || 0) * -2;
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_tds || 0) * 6;
    points += (stats.receptions || 0) * 1;
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_tds || 0) * 6;
    
    return Math.round(points * 100) / 100;
  }
  
  /**
   * Calculate fantasy points for NCAA basketball
   */
  private calculateNCAABasketballFantasy(stats: any): number {
    let points = 0;
    
    points += (stats.points || 0) * 1;
    points += (stats.rebounds || 0) * 1.2;
    points += (stats.assists || 0) * 1.5;
    points += (stats.steals || 0) * 3;
    points += (stats.blocks || 0) * 3;
    points += (stats.turnovers || 0) * -1;
    
    return Math.round(points * 100) / 100;
  }
  
  /**
   * Check if NCAA stats are significant
   */
  private hasSignificantNCAAStats(stats: any): boolean {
    const significantStats = [
      'completions', 'carries', 'receptions', 'points', 'rebounds', 'assists'
    ];
    
    return significantStats.some(stat => (stats[stat] || 0) > 0);
  }
  
  /**
   * Parse height string to inches
   */
  private parseHeight(heightStr?: string | any): number | undefined {
    if (!heightStr) return undefined;
    
    // Convert to string if it's not already
    const height = String(heightStr);
    
    const match = height.match(/(\d+)'?\s*(\d+)?/);
    if (match) {
      const feet = parseInt(match[1]) || 0;
      const inches = parseInt(match[2]) || 0;
      return feet * 12 + inches;
    }
    return undefined;
  }
  
  /**
   * Calculate draft eligibility year based on class
   */
  private calculateDraftEligibility(classYear?: string): number | undefined {
    if (!classYear) return undefined;
    
    const currentYear = new Date().getFullYear();
    const classMap: Record<string, number> = {
      'Freshman': currentYear + 3,
      'Sophomore': currentYear + 2,
      'Junior': currentYear + 1,
      'Senior': currentYear,
      'Graduate': currentYear
    };
    
    return classMap[classYear];
  }
}