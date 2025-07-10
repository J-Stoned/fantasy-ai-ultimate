import { BaseCollector } from './base-collector';
import { SportType, CollectedPlayer, CollectedGame } from './types';
import chalk from 'chalk';
import * as BloomFilter from 'bloom-filter';

interface NHLTeam {
  id: number;
  name: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
}

/**
 * NHL Master Collector
 * Uses free NHL Stats API for comprehensive data collection
 */
export class NHLMasterCollector extends BaseCollector {
  private readonly NHL_TEAMS: NHLTeam[] = [
    // Atlantic Division
    { id: 6, name: 'Bruins', abbreviation: 'BOS', city: 'Boston', conference: 'Eastern', division: 'Atlantic' },
    { id: 7, name: 'Sabres', abbreviation: 'BUF', city: 'Buffalo', conference: 'Eastern', division: 'Atlantic' },
    { id: 17, name: 'Red Wings', abbreviation: 'DET', city: 'Detroit', conference: 'Eastern', division: 'Atlantic' },
    { id: 13, name: 'Panthers', abbreviation: 'FLA', city: 'Florida', conference: 'Eastern', division: 'Atlantic' },
    { id: 8, name: 'Canadiens', abbreviation: 'MTL', city: 'Montreal', conference: 'Eastern', division: 'Atlantic' },
    { id: 9, name: 'Senators', abbreviation: 'OTT', city: 'Ottawa', conference: 'Eastern', division: 'Atlantic' },
    { id: 14, name: 'Lightning', abbreviation: 'TB', city: 'Tampa Bay', conference: 'Eastern', division: 'Atlantic' },
    { id: 10, name: 'Maple Leafs', abbreviation: 'TOR', city: 'Toronto', conference: 'Eastern', division: 'Atlantic' },
    
    // Metropolitan Division
    { id: 12, name: 'Hurricanes', abbreviation: 'CAR', city: 'Carolina', conference: 'Eastern', division: 'Metropolitan' },
    { id: 29, name: 'Blue Jackets', abbreviation: 'CBJ', city: 'Columbus', conference: 'Eastern', division: 'Metropolitan' },
    { id: 1, name: 'Devils', abbreviation: 'NJD', city: 'New Jersey', conference: 'Eastern', division: 'Metropolitan' },
    { id: 2, name: 'Islanders', abbreviation: 'NYI', city: 'New York', conference: 'Eastern', division: 'Metropolitan' },
    { id: 3, name: 'Rangers', abbreviation: 'NYR', city: 'New York', conference: 'Eastern', division: 'Metropolitan' },
    { id: 4, name: 'Flyers', abbreviation: 'PHI', city: 'Philadelphia', conference: 'Eastern', division: 'Metropolitan' },
    { id: 5, name: 'Penguins', abbreviation: 'PIT', city: 'Pittsburgh', conference: 'Eastern', division: 'Metropolitan' },
    { id: 15, name: 'Capitals', abbreviation: 'WSH', city: 'Washington', conference: 'Eastern', division: 'Metropolitan' },
    
    // Central Division
    { id: 53, name: 'Coyotes', abbreviation: 'ARI', city: 'Arizona', conference: 'Western', division: 'Central' },
    { id: 16, name: 'Blackhawks', abbreviation: 'CHI', city: 'Chicago', conference: 'Western', division: 'Central' },
    { id: 21, name: 'Avalanche', abbreviation: 'COL', city: 'Colorado', conference: 'Western', division: 'Central' },
    { id: 25, name: 'Stars', abbreviation: 'DAL', city: 'Dallas', conference: 'Western', division: 'Central' },
    { id: 30, name: 'Wild', abbreviation: 'MIN', city: 'Minnesota', conference: 'Western', division: 'Central' },
    { id: 18, name: 'Predators', abbreviation: 'NSH', city: 'Nashville', conference: 'Western', division: 'Central' },
    { id: 19, name: 'Blues', abbreviation: 'STL', city: 'St. Louis', conference: 'Western', division: 'Central' },
    { id: 52, name: 'Jets', abbreviation: 'WPG', city: 'Winnipeg', conference: 'Western', division: 'Central' },
    
    // Pacific Division
    { id: 24, name: 'Ducks', abbreviation: 'ANA', city: 'Anaheim', conference: 'Western', division: 'Pacific' },
    { id: 20, name: 'Flames', abbreviation: 'CGY', city: 'Calgary', conference: 'Western', division: 'Pacific' },
    { id: 22, name: 'Oilers', abbreviation: 'EDM', city: 'Edmonton', conference: 'Western', division: 'Pacific' },
    { id: 26, name: 'Kings', abbreviation: 'LA', city: 'Los Angeles', conference: 'Western', division: 'Pacific' },
    { id: 28, name: 'Sharks', abbreviation: 'SJ', city: 'San Jose', conference: 'Western', division: 'Pacific' },
    { id: 55, name: 'Kraken', abbreviation: 'SEA', city: 'Seattle', conference: 'Western', division: 'Pacific' },
    { id: 23, name: 'Canucks', abbreviation: 'VAN', city: 'Vancouver', conference: 'Western', division: 'Pacific' },
    { id: 54, name: 'Golden Knights', abbreviation: 'VGK', city: 'Vegas', conference: 'Western', division: 'Pacific' }
  ];
  
  private readonly BASE_URL = 'https://statsapi.web.nhl.com/api/v1';
  
  constructor() {
    super('NHL');
  }
  
  protected getSportType(): SportType {
    return 'hockey' as SportType;
  }
  
  protected getApiDelay(): number {
    return 1000; // 1 second between API calls
  }
  
  /**
   * Main collection process
   */
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🏒 NHL Master Collector Starting...\n'));
    
    try {
      // 1. Collect all teams
      await this.collectAllTeams();
      
      // 2. Collect players for each team
      await this.collectAllPlayers();
      
      // 3. Collect recent games
      await this.collectRecentGames();
      
      // Final report
      this.printFinalReport();
      
    } catch (error) {
      console.error(chalk.red('\n❌ Collection failed:'), error);
      throw error;
    }
  }
  
  /**
   * Collect all NHL teams
   */
  private async collectAllTeams(): Promise<void> {
    console.log(chalk.yellow('\n📋 Collecting NHL teams...\n'));
    
    let created = 0;
    
    for (const team of this.NHL_TEAMS) {
      try {
        const teamData = {
          id: 0, // Will be set by database
          external_id: `nhl_${team.id}`,
          name: team.name,
          sport: 'hockey' as SportType,
          conference: team.conference,
          division: team.division,
          abbreviation: team.abbreviation,
          city: team.city,
          full_name: `${team.city} ${team.name}`,
          logo_url: `https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/${team.id}.svg`
        };
        
        const result = await this.saveToDatabase('teams', teamData);
        if (result.created) created++;
        
      } catch (error) {
        console.error(`Error saving team ${team.name}:`, error);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.NHL_TEAMS.length} teams (${created} new)`));
  }
  
  /**
   * Collect all NHL players
   */
  private async collectAllPlayers(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting NHL players...\n'));
    
    for (const team of this.NHL_TEAMS) {
      console.log(chalk.gray(`Collecting roster for ${team.city} ${team.name}...`));
      
      try {
        await this.collectTeamRoster(team);
        await this.delay(this.getApiDelay());
      } catch (error) {
        console.error(`Error collecting ${team.name} roster:`, error);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.stats.playersCreated} NHL players`));
  }
  
  /**
   * Collect roster for a specific team
   */
  private async collectTeamRoster(team: NHLTeam): Promise<void> {
    try {
      const url = `${this.BASE_URL}/teams/${team.id}/roster`;
      
      const response = await this.makeApiCall<any>(url);
      if (!response?.roster) return;
      
      for (const player of response.roster) {
        await this.processNHLPlayer(player, team);
      }
      
    } catch (error) {
      console.error(`Error collecting ${team.name} roster:`, error);
    }
  }
  
  /**
   * Process individual NHL player
   */
  private async processNHLPlayer(player: any, team: NHLTeam): Promise<void> {
    try {
      const person = player.person;
      if (!person) return;
      
      // Get detailed player info
      const detailUrl = `${this.BASE_URL}/people/${person.id}`;
      const details = await this.makeApiCall<any>(detailUrl);
      const playerDetail = details?.people?.[0];
      
      if (!playerDetail) return;
      
      const playerData: CollectedPlayer = {
        external_id: `nhl_${person.id}`,
        firstname: playerDetail.firstName,
        lastname: playerDetail.lastName,
        name: playerDetail.fullName,
        sport: 'hockey',
        team: team.abbreviation,
        position: player.position?.abbreviation,
        jersey_number: player.jerseyNumber,
        heightfeet: playerDetail.height ? this.parseHeightFeet(playerDetail.height) : undefined,
        heightinches: playerDetail.height ? this.parseHeightInches(playerDetail.height) : undefined,
        weight: playerDetail.weight,
        birth_date: playerDetail.birthDate,
        birth_city: playerDetail.birthCity,
        birth_state: playerDetail.birthStateProvince,
        birth_country: playerDetail.birthCountry,
        is_active: playerDetail.active || false,
        years_pro: this.calculateYearsPro(playerDetail),
        photo_url: `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${person.id}.jpg`,
        metadata: {
          shoots: playerDetail.shootsCatches,
          captain: playerDetail.captain || false,
          alternate_captain: playerDetail.alternateCaptain || false,
          rookie: playerDetail.rookie || false,
          roster_status: playerDetail.rosterStatus,
          current_age: playerDetail.currentAge,
          nationality: playerDetail.nationality
        }
      };
      
      const result = await this.saveToDatabase('players', playerData);
      if (result.created) {
        this.stats.playersCreated++;
      } else {
        this.stats.playersUpdated++;
      }
      
    } catch (error) {
      console.error(`Error processing player ${person.fullName}:`, error);
    }
  }
  
  /**
   * Collect recent NHL games
   */
  private async collectRecentGames(): Promise<void> {
    console.log(chalk.yellow('\n🏒 Collecting recent NHL games...\n'));
    
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const start = startDate.toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];
      
      const url = `${this.BASE_URL}/schedule?startDate=${start}&endDate=${end}`;
      
      const response = await this.makeApiCall<any>(url);
      if (!response?.dates) return;
      
      for (const date of response.dates) {
        for (const game of date.games) {
          await this.processNHLGame(game);
        }
      }
      
      console.log(chalk.green(`✓ Collected ${this.stats.gamesCreated} NHL games`));
      
    } catch (error) {
      console.error('Error collecting games:', error);
    }
  }
  
  /**
   * Process individual NHL game
   */
  private async processNHLGame(game: any): Promise<void> {
    try {
      const homeTeam = this.NHL_TEAMS.find(t => t.id === game.teams.home.team.id);
      const awayTeam = this.NHL_TEAMS.find(t => t.id === game.teams.away.team.id);
      
      if (!homeTeam || !awayTeam) return;
      
      const gameData: CollectedGame = {
        external_id: `nhl_${game.gamePk}`,
        sport: 'hockey',
        home_team: homeTeam.abbreviation,
        away_team: awayTeam.abbreviation,
        home_score: game.teams.home.score,
        away_score: game.teams.away.score,
        scheduled_at: new Date(game.gameDate),
        status: game.status.abstractGameState === 'Final' ? 'completed' : 'scheduled',
        season: parseInt(game.season.substring(0, 4)),
        season_type: game.gameType === 'R' ? 'regular' : 'playoffs',
        venue: game.venue?.name,
        metadata: {
          game_type: game.gameType,
          game_state: game.status.detailedState,
          current_period: game.linescore?.currentPeriod,
          current_period_time: game.linescore?.currentPeriodTimeRemaining,
          has_shootout: game.linescore?.hasShootout,
          intermission: game.linescore?.intermissionInfo?.inIntermission
        }
      };
      
      const result = await this.saveToDatabase('games', gameData);
      if (result.created) {
        this.stats.gamesCreated++;
      } else {
        this.stats.gamesUpdated++;
      }
      
    } catch (error) {
      console.error(`Error processing game ${game.gamePk}:`, error);
    }
  }
  
  /**
   * Parse height to feet
   */
  private parseHeightFeet(height: string): number | undefined {
    const match = height.match(/(\d+)'/);
    return match ? parseInt(match[1]) : undefined;
  }
  
  /**
   * Parse height to inches
   */
  private parseHeightInches(height: string): number | undefined {
    const match = height.match(/'.*?(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
  
  /**
   * Calculate years pro
   */
  private calculateYearsPro(playerDetail: any): number {
    if (!playerDetail.primaryNumber) return 0;
    
    // NHL API doesn't provide debut date directly, so we estimate
    const currentAge = playerDetail.currentAge || 0;
    const typicalStartAge = 20;
    
    return Math.max(0, currentAge - typicalStartAge);
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new NHLMasterCollector();
  collector.collect()
    .then(() => console.log(chalk.bold.green('\n✅ NHL collection complete!')))
    .catch(error => {
      console.error(chalk.bold.red('\n❌ NHL collection failed:'), error);
      process.exit(1);
    });
}