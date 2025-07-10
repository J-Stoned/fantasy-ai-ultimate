import { BaseCollector } from './base-collector';
import { SportType, CollectedPlayer, CollectedGame } from './types';
import chalk from 'chalk';
import * as BloomFilter from 'bloom-filter';

interface NBATeam {
  id: string;
  tricode: string;
  name: string;
  city: string;
}

interface NBAPlayer {
  id: string;
  firstname: string;
  lastname: string;
  jersey?: string;
  position?: string;
  height?: string;
  weight?: string;
  teamId?: string;
  country?: string;
  dateOfBirth?: string;
}

/**
 * NBA Master Collector
 * Uses free NBA API endpoints for comprehensive data collection
 */
export class NBAMasterCollector extends BaseCollector {
  private readonly NBA_TEAMS: NBATeam[] = [
    // Atlantic Division
    { id: '1610612738', tricode: 'BOS', name: 'Celtics', city: 'Boston' },
    { id: '1610612751', tricode: 'BKN', name: 'Nets', city: 'Brooklyn' },
    { id: '1610612752', tricode: 'NYK', name: 'Knicks', city: 'New York' },
    { id: '1610612755', tricode: 'PHI', name: '76ers', city: 'Philadelphia' },
    { id: '1610612761', tricode: 'TOR', name: 'Raptors', city: 'Toronto' },
    
    // Central Division
    { id: '1610612741', tricode: 'CHI', name: 'Bulls', city: 'Chicago' },
    { id: '1610612739', tricode: 'CLE', name: 'Cavaliers', city: 'Cleveland' },
    { id: '1610612765', tricode: 'DET', name: 'Pistons', city: 'Detroit' },
    { id: '1610612754', tricode: 'IND', name: 'Pacers', city: 'Indiana' },
    { id: '1610612749', tricode: 'MIL', name: 'Bucks', city: 'Milwaukee' },
    
    // Southeast Division
    { id: '1610612737', tricode: 'ATL', name: 'Hawks', city: 'Atlanta' },
    { id: '1610612766', tricode: 'CHA', name: 'Hornets', city: 'Charlotte' },
    { id: '1610612748', tricode: 'MIA', name: 'Heat', city: 'Miami' },
    { id: '1610612753', tricode: 'ORL', name: 'Magic', city: 'Orlando' },
    { id: '1610612764', tricode: 'WAS', name: 'Wizards', city: 'Washington' },
    
    // Northwest Division
    { id: '1610612743', tricode: 'DEN', name: 'Nuggets', city: 'Denver' },
    { id: '1610612750', tricode: 'MIN', name: 'Timberwolves', city: 'Minnesota' },
    { id: '1610612760', tricode: 'OKC', name: 'Thunder', city: 'Oklahoma City' },
    { id: '1610612757', tricode: 'POR', name: 'Trail Blazers', city: 'Portland' },
    { id: '1610612762', tricode: 'UTA', name: 'Jazz', city: 'Utah' },
    
    // Pacific Division
    { id: '1610612744', tricode: 'GSW', name: 'Warriors', city: 'Golden State' },
    { id: '1610612746', tricode: 'LAC', name: 'Clippers', city: 'LA' },
    { id: '1610612747', tricode: 'LAL', name: 'Lakers', city: 'Los Angeles' },
    { id: '1610612756', tricode: 'PHX', name: 'Suns', city: 'Phoenix' },
    { id: '1610612758', tricode: 'SAC', name: 'Kings', city: 'Sacramento' },
    
    // Southwest Division
    { id: '1610612742', tricode: 'DAL', name: 'Mavericks', city: 'Dallas' },
    { id: '1610612745', tricode: 'HOU', name: 'Rockets', city: 'Houston' },
    { id: '1610612763', tricode: 'MEM', name: 'Grizzlies', city: 'Memphis' },
    { id: '1610612740', tricode: 'NOP', name: 'Pelicans', city: 'New Orleans' },
    { id: '1610612759', tricode: 'SAS', name: 'Spurs', city: 'San Antonio' }
  ];
  
  constructor() {
    super('NBA');
  }
  
  protected getSportType(): SportType {
    return 'basketball' as SportType;
  }
  
  protected getApiDelay(): number {
    return 1500; // 1.5 seconds between API calls
  }
  
  /**
   * Main collection process
   */
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🏀 NBA Master Collector Starting...\n'));
    
    try {
      // 1. Collect all teams first
      await this.collectAllTeams();
      
      // 2. Collect all players
      await this.collectAllPlayers();
      
      // 3. Collect recent games
      await this.collectRecentGames();
      
      // 4. Collect player stats for recent games
      await this.collectPlayerStats();
      
      // Final report
      this.printFinalReport();
      
    } catch (error) {
      console.error(chalk.red('\n❌ Collection failed:'), error);
      throw error;
    }
  }
  
  /**
   * Collect all NBA teams
   */
  private async collectAllTeams(): Promise<void> {
    console.log(chalk.yellow('\n📋 Collecting NBA teams...\n'));
    
    let created = 0;
    for (const team of this.NBA_TEAMS) {
      try {
        const teamData = {
          id: 0, // Will be set by database
          external_id: `nba_${team.id}`,
          name: team.name,
          sport: 'basketball' as SportType,
          conference: this.getConference(team.tricode),
          division: this.getDivision(team.tricode),
          abbreviation: team.tricode,
          city: team.city,
          full_name: `${team.city} ${team.name}`,
          logo_url: `https://cdn.nba.com/logos/nba/${team.id}/primary/L/logo.svg`
        };
        
        const result = await this.saveToDatabase('teams', teamData);
        if (result.created) created++;
        
      } catch (error) {
        console.error(`Error saving team ${team.name}:`, error);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.NBA_TEAMS.length} teams (${created} new)`));
  }
  
  /**
   * Collect all NBA players
   */
  private async collectAllPlayers(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting NBA players...\n'));
    
    try {
      // Use the NBA API to get all players
      const url = 'https://data.nba.net/data/10s/prod/v1/2024/players.json';
      
      const response = await this.makeApiCall<any>(url);
      if (!response?.league?.standard) {
        console.error('No player data found');
        return;
      }
      
      const players = response.league.standard;
      console.log(chalk.gray(`Found ${players.length} players`));
      
      // Process in batches
      const batches = this.chunkArray(players, 50);
      
      for (let i = 0; i < batches.length; i++) {
        console.log(chalk.gray(`Processing batch ${i + 1}/${batches.length}...`));
        
        await Promise.all(
          batches[i].map(player => this.processNBAPlayer(player))
        );
        
        await this.delay(1000); // Rate limiting between batches
      }
      
      console.log(chalk.green(`✓ Collected ${this.stats.playersCreated} NBA players`));
      
    } catch (error) {
      console.error('Error collecting players:', error);
    }
  }
  
  /**
   * Process individual NBA player
   */
  private async processNBAPlayer(player: any): Promise<void> {
    try {
      // Skip if player doesn't have required data
      if (!player.firstName || !player.lastName) return;
      
      const playerData: CollectedPlayer = {
        external_id: `nba_${player.personId}`,
        firstname: player.firstName,
        lastname: player.lastName,
        name: `${player.firstName} ${player.lastName}`,
        sport: 'basketball',
        team: this.getTeamTricode(player.teamId),
        position: player.pos || undefined,
        jersey_number: player.jersey || undefined,
        heightfeet: player.heightFeet ? parseInt(player.heightFeet) : undefined,
        heightinches: player.heightInches ? parseInt(player.heightInches) : undefined,
        weight: player.weightPounds ? parseInt(player.weightPounds) : undefined,
        birth_date: player.dateOfBirthUTC || undefined,
        birth_city: player.birthCity || undefined,
        birth_state: player.birthState || undefined,
        birth_country: player.country || undefined,
        college: player.collegeName || undefined,
        draft_year: player.draft?.year ? parseInt(player.draft.year) : undefined,
        draft_round: player.draft?.roundNum ? parseInt(player.draft.roundNum) : undefined,
        draft_pick: player.draft?.pickNum ? parseInt(player.draft.pickNum) : undefined,
        photo_url: `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.personId}.png`,
        is_active: player.isActive || false,
        years_pro: player.yearsPro ? parseInt(player.yearsPro) : 0,
        metadata: {
          nba_debut_year: player.nbaDebutYear,
          jersey: player.jersey,
          is_rookie: player.yearsPro === '0'
        }
      };
      
      const result = await this.saveToDatabase('players', playerData);
      if (result.created) {
        this.stats.playersCreated++;
      } else {
        this.stats.playersUpdated++;
      }
      
    } catch (error) {
      console.error(`Error processing player ${player.firstName} ${player.lastName}:`, error);
    }
  }
  
  /**
   * Collect recent NBA games
   */
  private async collectRecentGames(): Promise<void> {
    console.log(chalk.yellow('\n🏀 Collecting recent NBA games...\n'));
    
    try {
      // Get games for the current season
      const currentDate = new Date();
      const season = currentDate.getMonth() >= 8 ? currentDate.getFullYear() : currentDate.getFullYear() - 1;
      
      // Collect games for each month of the season
      const months = ['10', '11', '12', '01', '02', '03', '04'];
      
      for (const month of months) {
        const year = month >= '10' ? season : season + 1;
        await this.collectGamesForMonth(year, month);
      }
      
      console.log(chalk.green(`✓ Collected ${this.stats.gamesCreated} NBA games`));
      
    } catch (error) {
      console.error('Error collecting games:', error);
    }
  }
  
  /**
   * Collect games for a specific month
   */
  private async collectGamesForMonth(year: number, month: string): Promise<void> {
    try {
      const url = `https://data.nba.net/data/10s/prod/v1/${year}${month}/scoreboard.json`;
      
      const response = await this.makeApiCall<any>(url);
      if (!response?.games) return;
      
      for (const game of response.games) {
        await this.processNBAGame(game);
      }
      
    } catch (error) {
      // Month might not exist yet
      console.log(chalk.gray(`No games found for ${year}-${month}`));
    }
  }
  
  /**
   * Process individual NBA game
   */
  private async processNBAGame(game: any): Promise<void> {
    try {
      const gameData: CollectedGame = {
        external_id: `nba_${game.gameId}`,
        sport: 'basketball',
        home_team: this.getTeamTricode(game.hTeam.teamId),
        away_team: this.getTeamTricode(game.vTeam.teamId),
        home_score: game.hTeam.score ? parseInt(game.hTeam.score) : undefined,
        away_score: game.vTeam.score ? parseInt(game.vTeam.score) : undefined,
        scheduled_at: new Date(game.startTimeUTC),
        status: game.statusNum === 3 ? 'completed' : 'scheduled',
        season: game.seasonYear,
        season_type: game.seasonStageId === 2 ? 'regular' : 'playoffs',
        venue: game.arena?.name,
        attendance: game.attendance ? parseInt(game.attendance) : undefined,
        metadata: {
          game_duration: game.gameDuration,
          nugget: game.nugget?.text,
          playoffs_round: game.playoffs?.roundNum,
          playoffs_conference: game.playoffs?.confName
        }
      };
      
      const result = await this.saveToDatabase('games', gameData);
      if (result.created) {
        this.stats.gamesCreated++;
      } else {
        this.stats.gamesUpdated++;
      }
      
    } catch (error) {
      console.error(`Error processing game ${game.gameId}:`, error);
    }
  }
  
  /**
   * Collect player stats for recent games
   */
  private async collectPlayerStats(): Promise<void> {
    console.log(chalk.yellow('\n📊 Collecting player stats...\n'));
    
    // This would require game-by-game boxscore API calls
    // Skipping for now to avoid rate limits
    
    console.log(chalk.yellow('⚠️  Player stats collection requires individual game API calls'));
  }
  
  /**
   * Get team tricode from ID
   */
  private getTeamTricode(teamId: string): string | undefined {
    const team = this.NBA_TEAMS.find(t => t.id === teamId);
    return team?.tricode;
  }
  
  /**
   * Get conference for team
   */
  private getConference(tricode: string): string {
    const eastTeams = ['BOS', 'BKN', 'NYK', 'PHI', 'TOR', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 
                       'ATL', 'CHA', 'MIA', 'ORL', 'WAS'];
    return eastTeams.includes(tricode) ? 'Eastern' : 'Western';
  }
  
  /**
   * Get division for team
   */
  private getDivision(tricode: string): string {
    const divisions: { [key: string]: string[] } = {
      'Atlantic': ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'],
      'Central': ['CHI', 'CLE', 'DET', 'IND', 'MIL'],
      'Southeast': ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
      'Northwest': ['DEN', 'MIN', 'OKC', 'POR', 'UTA'],
      'Pacific': ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'],
      'Southwest': ['DAL', 'HOU', 'MEM', 'NOP', 'SAS']
    };
    
    for (const [division, teams] of Object.entries(divisions)) {
      if (teams.includes(tricode)) return division;
    }
    
    return 'Unknown';
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new NBAMasterCollector();
  collector.collect()
    .then(() => console.log(chalk.bold.green('\n✅ NBA collection complete!')))
    .catch(error => {
      console.error(chalk.bold.red('\n❌ NBA collection failed:'), error);
      process.exit(1);
    });
}