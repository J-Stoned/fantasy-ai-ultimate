import { BaseCollector } from './base-collector';
import { SportType, CollectedPlayer, CollectedGame } from './types';
import chalk from 'chalk';
import * as BloomFilter from 'bloom-filter';

interface MLBTeam {
  id: number;
  name: string;
  abbreviation: string;
  city: string;
  league: string;
  division: string;
}

/**
 * MLB Master Collector
 * Uses free MLB Stats API for comprehensive data collection
 */
export class MLBMasterCollector extends BaseCollector {
  private readonly MLB_TEAMS: MLBTeam[] = [
    // American League East
    { id: 110, name: 'Orioles', abbreviation: 'BAL', city: 'Baltimore', league: 'AL', division: 'East' },
    { id: 111, name: 'Red Sox', abbreviation: 'BOS', city: 'Boston', league: 'AL', division: 'East' },
    { id: 147, name: 'Yankees', abbreviation: 'NYY', city: 'New York', league: 'AL', division: 'East' },
    { id: 139, name: 'Rays', abbreviation: 'TB', city: 'Tampa Bay', league: 'AL', division: 'East' },
    { id: 141, name: 'Blue Jays', abbreviation: 'TOR', city: 'Toronto', league: 'AL', division: 'East' },
    
    // American League Central
    { id: 145, name: 'White Sox', abbreviation: 'CWS', city: 'Chicago', league: 'AL', division: 'Central' },
    { id: 114, name: 'Guardians', abbreviation: 'CLE', city: 'Cleveland', league: 'AL', division: 'Central' },
    { id: 116, name: 'Tigers', abbreviation: 'DET', city: 'Detroit', league: 'AL', division: 'Central' },
    { id: 118, name: 'Royals', abbreviation: 'KC', city: 'Kansas City', league: 'AL', division: 'Central' },
    { id: 142, name: 'Twins', abbreviation: 'MIN', city: 'Minnesota', league: 'AL', division: 'Central' },
    
    // American League West
    { id: 117, name: 'Astros', abbreviation: 'HOU', city: 'Houston', league: 'AL', division: 'West' },
    { id: 108, name: 'Angels', abbreviation: 'LAA', city: 'Los Angeles', league: 'AL', division: 'West' },
    { id: 133, name: 'Athletics', abbreviation: 'OAK', city: 'Oakland', league: 'AL', division: 'West' },
    { id: 136, name: 'Mariners', abbreviation: 'SEA', city: 'Seattle', league: 'AL', division: 'West' },
    { id: 140, name: 'Rangers', abbreviation: 'TEX', city: 'Texas', league: 'AL', division: 'West' },
    
    // National League East
    { id: 144, name: 'Braves', abbreviation: 'ATL', city: 'Atlanta', league: 'NL', division: 'East' },
    { id: 146, name: 'Marlins', abbreviation: 'MIA', city: 'Miami', league: 'NL', division: 'East' },
    { id: 121, name: 'Mets', abbreviation: 'NYM', city: 'New York', league: 'NL', division: 'East' },
    { id: 143, name: 'Phillies', abbreviation: 'PHI', city: 'Philadelphia', league: 'NL', division: 'East' },
    { id: 120, name: 'Nationals', abbreviation: 'WSH', city: 'Washington', league: 'NL', division: 'East' },
    
    // National League Central
    { id: 112, name: 'Cubs', abbreviation: 'CHC', city: 'Chicago', league: 'NL', division: 'Central' },
    { id: 113, name: 'Reds', abbreviation: 'CIN', city: 'Cincinnati', league: 'NL', division: 'Central' },
    { id: 158, name: 'Brewers', abbreviation: 'MIL', city: 'Milwaukee', league: 'NL', division: 'Central' },
    { id: 134, name: 'Pirates', abbreviation: 'PIT', city: 'Pittsburgh', league: 'NL', division: 'Central' },
    { id: 138, name: 'Cardinals', abbreviation: 'STL', city: 'St. Louis', league: 'NL', division: 'Central' },
    
    // National League West
    { id: 109, name: 'Diamondbacks', abbreviation: 'AZ', city: 'Arizona', league: 'NL', division: 'West' },
    { id: 115, name: 'Rockies', abbreviation: 'COL', city: 'Colorado', league: 'NL', division: 'West' },
    { id: 119, name: 'Dodgers', abbreviation: 'LAD', city: 'Los Angeles', league: 'NL', division: 'West' },
    { id: 135, name: 'Padres', abbreviation: 'SD', city: 'San Diego', league: 'NL', division: 'West' },
    { id: 137, name: 'Giants', abbreviation: 'SF', city: 'San Francisco', league: 'NL', division: 'West' }
  ];
  
  private readonly BASE_URL = 'https://statsapi.mlb.com/api/v1';
  
  constructor() {
    super('MLB');
  }
  
  protected getSportType(): SportType {
    return 'baseball' as SportType;
  }
  
  protected getApiDelay(): number {
    return 1000; // 1 second between API calls
  }
  
  /**
   * Main collection process
   */
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n⚾ MLB Master Collector Starting...\n'));
    
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
   * Collect all MLB teams
   */
  private async collectAllTeams(): Promise<void> {
    console.log(chalk.yellow('\n📋 Collecting MLB teams...\n'));
    
    let created = 0;
    
    for (const team of this.MLB_TEAMS) {
      try {
        const teamData = {
          id: 0, // Will be set by database
          external_id: `mlb_${team.id}`,
          name: team.name,
          sport: 'baseball' as SportType,
          conference: team.league,
          division: `${team.league} ${team.division}`,
          abbreviation: team.abbreviation,
          city: team.city,
          full_name: `${team.city} ${team.name}`,
          logo_url: `https://www.mlbstatic.com/team-logos/${team.id}.svg`
        };
        
        const result = await this.saveToDatabase('teams', teamData);
        if (result.created) created++;
        
      } catch (error) {
        console.error(`Error saving team ${team.name}:`, error);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.MLB_TEAMS.length} teams (${created} new)`));
  }
  
  /**
   * Collect all MLB players
   */
  private async collectAllPlayers(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting MLB players...\n'));
    
    for (const team of this.MLB_TEAMS) {
      console.log(chalk.gray(`Collecting roster for ${team.city} ${team.name}...`));
      
      try {
        await this.collectTeamRoster(team);
        await this.delay(this.getApiDelay());
      } catch (error) {
        console.error(`Error collecting ${team.name} roster:`, error);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.stats.playersCreated} MLB players`));
  }
  
  /**
   * Collect roster for a specific team
   */
  private async collectTeamRoster(team: MLBTeam): Promise<void> {
    try {
      const url = `${this.BASE_URL}/teams/${team.id}/roster`;
      
      const response = await this.makeApiCall<any>(url);
      if (!response?.roster) return;
      
      for (const player of response.roster) {
        await this.processMLBPlayer(player, team);
      }
      
    } catch (error) {
      console.error(`Error collecting ${team.name} roster:`, error);
    }
  }
  
  /**
   * Process individual MLB player
   */
  private async processMLBPlayer(player: any, team: MLBTeam): Promise<void> {
    try {
      const person = player.person;
      if (!person) return;
      
      // Get detailed player info
      const detailUrl = `${this.BASE_URL}/people/${person.id}`;
      const details = await this.makeApiCall<any>(detailUrl);
      const playerDetail = details?.people?.[0];
      
      if (!playerDetail) return;
      
      const playerData: CollectedPlayer = {
        external_id: `mlb_${person.id}`,
        firstname: playerDetail.firstName || person.firstName,
        lastname: playerDetail.lastName || person.lastName,
        name: playerDetail.fullName || person.fullName,
        sport: 'baseball',
        team: team.abbreviation,
        position: player.position?.abbreviation,
        jersey_number: player.jerseyNumber,
        heightfeet: playerDetail.height ? this.parseHeightFeet(playerDetail.height) : undefined,
        heightinches: playerDetail.height ? this.parseHeightInches(playerDetail.height) : undefined,
        weight: playerDetail.weight ? parseInt(playerDetail.weight) : undefined,
        birth_date: playerDetail.birthDate,
        birth_city: playerDetail.birthCity,
        birth_state: playerDetail.birthStateProvince,
        birth_country: playerDetail.birthCountry,
        college: playerDetail.college,
        draft_year: playerDetail.draftYear,
        is_active: playerDetail.active || false,
        years_pro: playerDetail.mlbDebutDate ? this.calculateYearsPro(playerDetail.mlbDebutDate) : 0,
        photo_url: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${person.id}/headshot/67/current`,
        metadata: {
          bats: playerDetail.batSide?.code,
          throws: playerDetail.pitchHand?.code,
          mlb_debut: playerDetail.mlbDebutDate,
          primary_position: playerDetail.primaryPosition?.abbreviation
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
   * Collect recent MLB games
   */
  private async collectRecentGames(): Promise<void> {
    console.log(chalk.yellow('\n⚾ Collecting recent MLB games...\n'));
    
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const start = startDate.toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];
      
      const url = `${this.BASE_URL}/schedule?sportId=1&startDate=${start}&endDate=${end}`;
      
      const response = await this.makeApiCall<any>(url);
      if (!response?.dates) return;
      
      for (const date of response.dates) {
        for (const game of date.games) {
          await this.processMLBGame(game);
        }
      }
      
      console.log(chalk.green(`✓ Collected ${this.stats.gamesCreated} MLB games`));
      
    } catch (error) {
      console.error('Error collecting games:', error);
    }
  }
  
  /**
   * Process individual MLB game
   */
  private async processMLBGame(game: any): Promise<void> {
    try {
      const homeTeam = this.MLB_TEAMS.find(t => t.id === game.teams.home.team.id);
      const awayTeam = this.MLB_TEAMS.find(t => t.id === game.teams.away.team.id);
      
      if (!homeTeam || !awayTeam) return;
      
      const gameData: CollectedGame = {
        external_id: `mlb_${game.gamePk}`,
        sport: 'baseball',
        home_team: homeTeam.abbreviation,
        away_team: awayTeam.abbreviation,
        home_score: game.teams.home.score,
        away_score: game.teams.away.score,
        scheduled_at: new Date(game.gameDate),
        status: game.status.abstractGameState === 'Final' ? 'completed' : 'scheduled',
        season: new Date(game.gameDate).getFullYear(),
        season_type: game.seriesDescription || 'regular',
        venue: game.venue?.name,
        attendance: game.attendance,
        metadata: {
          game_number: game.gameNumber,
          double_header: game.doubleHeader !== 'N',
          day_night: game.dayNight,
          weather: game.weather,
          wind: game.wind,
          innings: game.scheduledInnings
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
    const match = height.match(/'(\d+)"/);
    return match ? parseInt(match[1]) : undefined;
  }
  
  /**
   * Calculate years pro from debut date
   */
  private calculateYearsPro(debutDate: string): number {
    const debut = new Date(debutDate);
    const now = new Date();
    return now.getFullYear() - debut.getFullYear();
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new MLBMasterCollector();
  collector.collect()
    .then(() => console.log(chalk.bold.green('\n✅ MLB collection complete!')))
    .catch(error => {
      console.error(chalk.bold.red('\n❌ MLB collection failed:'), error);
      process.exit(1);
    });
}