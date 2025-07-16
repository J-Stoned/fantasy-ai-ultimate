/**
 * 🏀 NBA MASTER COLLECTOR V2
 * Uses BallDontLie API instead of ESPN due to API limitations
 * Maintains ESPN ID compatibility for database consistency
 */

import { BaseCollector } from './base-collector';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface NBATeam {
  id: string;              // Our internal ID
  espnId: string;          // ESPN ID for compatibility
  ballDontLieId: number;   // BallDontLie API ID
  tricode: string;
  name: string;
  fullName: string;
  city: string;
}

export class NBAMasterCollectorV2 extends BaseCollector {
  private readonly NBA_TEAMS: NBATeam[] = [
    // Atlantic Division
    { id: '1610612738', espnId: '2', ballDontLieId: 2, tricode: 'BOS', name: 'Celtics', fullName: 'Boston Celtics', city: 'Boston' },
    { id: '1610612751', espnId: '17', ballDontLieId: 3, tricode: 'BKN', name: 'Nets', fullName: 'Brooklyn Nets', city: 'Brooklyn' },
    { id: '1610612752', espnId: '18', ballDontLieId: 20, tricode: 'NYK', name: 'Knicks', fullName: 'New York Knicks', city: 'New York' },
    { id: '1610612755', espnId: '20', ballDontLieId: 23, tricode: 'PHI', name: '76ers', fullName: 'Philadelphia 76ers', city: 'Philadelphia' },
    { id: '1610612761', espnId: '28', ballDontLieId: 28, tricode: 'TOR', name: 'Raptors', fullName: 'Toronto Raptors', city: 'Toronto' },
    
    // Central Division
    { id: '1610612741', espnId: '4', ballDontLieId: 5, tricode: 'CHI', name: 'Bulls', fullName: 'Chicago Bulls', city: 'Chicago' },
    { id: '1610612739', espnId: '5', ballDontLieId: 6, tricode: 'CLE', name: 'Cavaliers', fullName: 'Cleveland Cavaliers', city: 'Cleveland' },
    { id: '1610612765', espnId: '8', ballDontLieId: 9, tricode: 'DET', name: 'Pistons', fullName: 'Detroit Pistons', city: 'Detroit' },
    { id: '1610612754', espnId: '11', ballDontLieId: 12, tricode: 'IND', name: 'Pacers', fullName: 'Indiana Pacers', city: 'Indiana' },
    { id: '1610612749', espnId: '15', ballDontLieId: 17, tricode: 'MIL', name: 'Bucks', fullName: 'Milwaukee Bucks', city: 'Milwaukee' },
    
    // Southeast Division
    { id: '1610612737', espnId: '1', ballDontLieId: 1, tricode: 'ATL', name: 'Hawks', fullName: 'Atlanta Hawks', city: 'Atlanta' },
    { id: '1610612766', espnId: '30', ballDontLieId: 4, tricode: 'CHA', name: 'Hornets', fullName: 'Charlotte Hornets', city: 'Charlotte' },
    { id: '1610612748', espnId: '14', ballDontLieId: 16, tricode: 'MIA', name: 'Heat', fullName: 'Miami Heat', city: 'Miami' },
    { id: '1610612753', espnId: '19', ballDontLieId: 22, tricode: 'ORL', name: 'Magic', fullName: 'Orlando Magic', city: 'Orlando' },
    { id: '1610612764', espnId: '27', ballDontLieId: 30, tricode: 'WAS', name: 'Wizards', fullName: 'Washington Wizards', city: 'Washington' },
    
    // Northwest Division
    { id: '1610612743', espnId: '7', ballDontLieId: 8, tricode: 'DEN', name: 'Nuggets', fullName: 'Denver Nuggets', city: 'Denver' },
    { id: '1610612750', espnId: '16', ballDontLieId: 18, tricode: 'MIN', name: 'Timberwolves', fullName: 'Minnesota Timberwolves', city: 'Minnesota' },
    { id: '1610612760', espnId: '25', ballDontLieId: 21, tricode: 'OKC', name: 'Thunder', fullName: 'Oklahoma City Thunder', city: 'Oklahoma City' },
    { id: '1610612757', espnId: '22', ballDontLieId: 25, tricode: 'POR', name: 'Trail Blazers', fullName: 'Portland Trail Blazers', city: 'Portland' },
    { id: '1610612762', espnId: '26', ballDontLieId: 29, tricode: 'UTA', name: 'Jazz', fullName: 'Utah Jazz', city: 'Utah' },
    
    // Pacific Division
    { id: '1610612744', espnId: '9', ballDontLieId: 10, tricode: 'GSW', name: 'Warriors', fullName: 'Golden State Warriors', city: 'Golden State' },
    { id: '1610612746', espnId: '12', ballDontLieId: 13, tricode: 'LAC', name: 'Clippers', fullName: 'Los Angeles Clippers', city: 'Los Angeles' },
    { id: '1610612747', espnId: '13', ballDontLieId: 14, tricode: 'LAL', name: 'Lakers', fullName: 'Los Angeles Lakers', city: 'Los Angeles' },
    { id: '1610612756', espnId: '21', ballDontLieId: 24, tricode: 'PHX', name: 'Suns', fullName: 'Phoenix Suns', city: 'Phoenix' },
    { id: '1610612758', espnId: '23', ballDontLieId: 26, tricode: 'SAC', name: 'Kings', fullName: 'Sacramento Kings', city: 'Sacramento' },
    
    // Southwest Division
    { id: '1610612742', espnId: '6', ballDontLieId: 7, tricode: 'DAL', name: 'Mavericks', fullName: 'Dallas Mavericks', city: 'Dallas' },
    { id: '1610612745', espnId: '10', ballDontLieId: 11, tricode: 'HOU', name: 'Rockets', fullName: 'Houston Rockets', city: 'Houston' },
    { id: '1610612763', espnId: '29', ballDontLieId: 15, tricode: 'MEM', name: 'Grizzlies', fullName: 'Memphis Grizzlies', city: 'Memphis' },
    { id: '1610612740', espnId: '3', ballDontLieId: 19, tricode: 'NOP', name: 'Pelicans', fullName: 'New Orleans Pelicans', city: 'New Orleans' },
    { id: '1610612759', espnId: '24', ballDontLieId: 27, tricode: 'SAS', name: 'Spurs', fullName: 'San Antonio Spurs', city: 'San Antonio' }
  ];

  private ballDontLieApi = axios.create({
    baseURL: 'https://api.balldontlie.io/v1',
    headers: {
      'Authorization': process.env.BALLDONTLIE_API_KEY || '59de4292-dfc4-4a8a-b337-1e804f4109c6'
    }
  });

  constructor() {
    super({
      batchSize: 50,
      concurrentLimit: 3,
      retryAttempts: 3,
      retryDelay: 2000
    });
  }

  protected getSportType(): string {
    return 'nba';
  }

  protected getApiDelay(): number {
    return 2000; // 2 seconds between API calls to avoid rate limits
  }

  /**
   * Main collection process
   */
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🏀 NBA Master Collector V2 Starting...\n'));
    console.log(chalk.yellow('Using BallDontLie API for reliable data collection\n'));
    
    try {
      // 1. Collect all teams
      await this.collectAllTeams();
      
      // 2. Collect all players
      await this.collectAllPlayers();
      
      // 3. Collect recent games
      await this.collectRecentGames();
      
      // Final report
      this.printStats();
      
    } catch (error) {
      console.error(chalk.red('\n❌ Collection failed:'), error);
      throw error;
    } finally {
      this.cleanup();
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
        const cacheKey = `team_nba_${team.fullName}`;
        if (this.cache.get(cacheKey)) {
          console.log(chalk.gray(`  ${team.fullName} already exists (cached)`));
          continue;
        }
        
        // Check if team exists in database
        const { data: existingTeam } = await this.supabase
          .from('teams')
          .select('id')
          .eq('external_id', `espn_nba_${team.espnId}`)
          .single();
        
        if (existingTeam) {
          this.cache.set(cacheKey, existingTeam.id);
          console.log(chalk.gray(`  ${team.fullName} already exists`));
          continue;
        }
        
        // Create new team
        const teamData: any = {
          external_id: `espn_nba_${team.espnId}`,
          name: team.fullName,
          city: team.city,
          abbreviation: team.tricode,
          sport: 'basketball',
          sport_id: 'nba',
          league: 'NBA',
          league_id: 'nba',
          logo_url: `https://a.espncdn.com/i/teamlogos/nba/500/${team.tricode.toLowerCase()}.png`,
          metadata: {
            espn_id: team.espnId,
            balldontlie_id: team.ballDontLieId,
            nba_team_id: team.id,
            conference: this.getConference(team.tricode),
            division: this.getDivision(team.tricode)
          }
        };
        
        const { data, error } = await this.supabase
          .from('teams')
          .insert(teamData)
          .select('id')
          .single();
        
        if (error) {
          console.error(`Error creating team ${team.fullName}:`, error);
        } else if (data) {
          created++;
          this.cache.set(cacheKey, data.id);
          console.log(chalk.green(`  ✓ Created ${team.fullName}`));
        }
        
      } catch (error) {
        console.error(`Error saving team ${team.fullName}:`, error);
      }
    }
    
    console.log(chalk.green(`\n✓ Collected ${this.NBA_TEAMS.length} teams (${created} new)`));
  }

  /**
   * Collect all NBA players using BallDontLie API
   */
  private async collectAllPlayers(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting NBA players from BallDontLie API...\n'));
    
    let totalPlayers = 0;
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 3) { // Limit to 3 pages (300 players) to avoid rate limits
      try {
        console.log(chalk.gray(`Fetching page ${page}...`));
        
        const response = await this.ballDontLieApi.get('/players', {
          params: {
            per_page: 100,
            page: page
          }
        });
        
        const players = response.data.data;
        const meta = response.data.meta;
        
        console.log(chalk.gray(`  Found ${players.length} players on page ${page}`));
        
        // Process each player
        for (const player of players) {
          // Only process players with a team
          if (player.team) {
            await this.processBallDontLiePlayer(player);
            totalPlayers++;
          }
        }
        
        // Check if there are more pages
        hasMore = meta.next_page !== null;
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.getApiDelay()));
        
      } catch (error: any) {
        console.error(chalk.red(`Error fetching players page ${page}:`), error.message);
        hasMore = false;
      }
    }
    
    console.log(chalk.green(`\n✓ Collected ${totalPlayers} NBA players total`));
  }

  /**
   * Process BallDontLie player data
   */
  private async processBallDontLiePlayer(player: any): Promise<void> {
    try {
      // Find the team in our mapping
      const team = this.NBA_TEAMS.find(t => t.ballDontLieId === player.team.id);
      if (!team) {
        console.log(chalk.yellow(`  Warning: Unknown team ID ${player.team.id} for ${player.first_name} ${player.last_name}`));
        return;
      }
      
      // Get team_id from database
      const cacheKey = `team_nba_${team.fullName}`;
      let teamId = this.cache.get(cacheKey);
      
      if (!teamId) {
        const { data: teamData } = await this.supabase
          .from('teams')
          .select('id')
          .eq('external_id', `espn_nba_${team.espnId}`)
          .single();
        
        if (teamData) {
          teamId = teamData.id;
          this.cache.set(cacheKey, teamId);
        } else {
          console.error(chalk.red(`  Could not find team_id for ${team.fullName}`));
          return;
        }
      }
      
      // Calculate height in inches
      let heightInches = null;
      if (player.height_feet && player.height_inches) {
        heightInches = (player.height_feet * 12) + player.height_inches;
      }
      
      const playerData = {
        external_id: `balldontlie_nba_${player.id}`,
        firstname: player.first_name || '',
        lastname: player.last_name || '',
        name: `${player.first_name} ${player.last_name}`,
        sport: 'basketball',
        sport_id: 'nba',
        position: player.position ? [player.position] : [],
        team_id: teamId,
        jersey_number: player.jersey_number ? parseInt(player.jersey_number) : null,
        heightinches: heightInches,
        weightlbs: player.weight_pounds ? parseInt(player.weight_pounds) : null,
        status: 'active', // BallDontLie only returns active players
        team: team.fullName,
        team_abbreviation: team.tricode,
        metadata: {
          balldontlie_id: player.id,
          espn_team_id: team.espnId,
          country: player.country || null
        }
      };
      
      await this.upsertPlayer(playerData);
      
    } catch (error) {
      console.error(`Error processing player ${player.first_name} ${player.last_name}:`, error);
    }
  }

  /**
   * Collect recent NBA games
   */
  private async collectRecentGames(): Promise<void> {
    console.log(chalk.yellow('\n🏀 Collecting recent NBA games...\n'));
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7); // Last 7 days
    
    try {
      const response = await this.ballDontLieApi.get('/games', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0],
          per_page: 100
        }
      });
      
      const games = response.data.data;
      console.log(chalk.gray(`  Found ${games.length} games in the last 7 days`));
      
      let created = 0;
      for (const game of games) {
        const homeTeam = this.NBA_TEAMS.find(t => t.ballDontLieId === game.home_team.id);
        const awayTeam = this.NBA_TEAMS.find(t => t.ballDontLieId === game.visitor_team.id);
        
        if (!homeTeam || !awayTeam) {
          console.log(chalk.yellow(`  Warning: Unknown teams in game ${game.id}`));
          continue;
        }
        
        // Get team IDs from database
        const { data: homeTeamData } = await this.supabase
          .from('teams')
          .select('id')
          .eq('external_id', `espn_nba_${homeTeam.espnId}`)
          .single();
          
        const { data: awayTeamData } = await this.supabase
          .from('teams')
          .select('id')
          .eq('external_id', `espn_nba_${awayTeam.espnId}`)
          .single();
        
        if (!homeTeamData || !awayTeamData) continue;
        
        const gameData = {
          external_id: `balldontlie_nba_${game.id}`,
          sport: 'basketball',
          sport_id: 'nba',
          league_id: 'nba',
          start_time: new Date(game.date),
          status: game.status === 'Final' ? 'completed' : game.status.toLowerCase(),
          home_team_id: homeTeamData.id,
          away_team_id: awayTeamData.id,
          home_score: game.home_team_score,
          away_score: game.visitor_team_score,
          venue: homeTeam.city,
          season: game.season,
          metadata: {
            balldontlie_id: game.id,
            period: game.period,
            postseason: game.postseason,
            time_remaining: game.time
          }
        };
        
        const { error } = await this.supabase
          .from('games')
          .upsert(gameData, { onConflict: 'external_id' });
          
        if (!error) {
          created++;
          this.stats.gamesCreated++;
        }
      }
      
      console.log(chalk.green(`✓ Collected ${games.length} games (${created} new)`));
      
    } catch (error: any) {
      console.error(chalk.red('Error collecting games:'), error.message);
    }
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

// Export for use in scripts
export default NBAMasterCollectorV2;