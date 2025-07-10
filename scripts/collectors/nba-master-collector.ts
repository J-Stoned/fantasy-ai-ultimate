import { BaseCollector, CollectorConfig } from './base-collector';
import axios from 'axios';
import chalk from 'chalk';

interface NBATeam {
  id: string;
  espnId: string;  // ESPN's team ID
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
 * Uses ESPN API for comprehensive NBA data collection
 */
export class NBAMasterCollector extends BaseCollector {
  private readonly NBA_TEAMS: NBATeam[] = [
    // Atlantic Division
    { id: '1610612738', espnId: '2', tricode: 'BOS', name: 'Celtics', city: 'Boston' },
    { id: '1610612751', espnId: '17', tricode: 'BKN', name: 'Nets', city: 'Brooklyn' },
    { id: '1610612752', espnId: '18', tricode: 'NYK', name: 'Knicks', city: 'New York' },
    { id: '1610612755', espnId: '20', tricode: 'PHI', name: '76ers', city: 'Philadelphia' },
    { id: '1610612761', espnId: '28', tricode: 'TOR', name: 'Raptors', city: 'Toronto' },
    
    // Central Division
    { id: '1610612741', espnId: '4', tricode: 'CHI', name: 'Bulls', city: 'Chicago' },
    { id: '1610612739', espnId: '5', tricode: 'CLE', name: 'Cavaliers', city: 'Cleveland' },
    { id: '1610612765', espnId: '8', tricode: 'DET', name: 'Pistons', city: 'Detroit' },
    { id: '1610612754', espnId: '11', tricode: 'IND', name: 'Pacers', city: 'Indiana' },
    { id: '1610612749', espnId: '15', tricode: 'MIL', name: 'Bucks', city: 'Milwaukee' },
    
    // Southeast Division
    { id: '1610612737', espnId: '1', tricode: 'ATL', name: 'Hawks', city: 'Atlanta' },
    { id: '1610612766', espnId: '30', tricode: 'CHA', name: 'Hornets', city: 'Charlotte' },
    { id: '1610612748', espnId: '14', tricode: 'MIA', name: 'Heat', city: 'Miami' },
    { id: '1610612753', espnId: '19', tricode: 'ORL', name: 'Magic', city: 'Orlando' },
    { id: '1610612764', espnId: '27', tricode: 'WAS', name: 'Wizards', city: 'Washington' },
    
    // Northwest Division
    { id: '1610612743', espnId: '7', tricode: 'DEN', name: 'Nuggets', city: 'Denver' },
    { id: '1610612750', espnId: '16', tricode: 'MIN', name: 'Timberwolves', city: 'Minnesota' },
    { id: '1610612760', espnId: '25', tricode: 'OKC', name: 'Thunder', city: 'Oklahoma City' },
    { id: '1610612757', espnId: '22', tricode: 'POR', name: 'Trail Blazers', city: 'Portland' },
    { id: '1610612762', espnId: '26', tricode: 'UTA', name: 'Jazz', city: 'Utah' },
    
    // Pacific Division
    { id: '1610612744', espnId: '9', tricode: 'GSW', name: 'Warriors', city: 'Golden State' },
    { id: '1610612746', espnId: '12', tricode: 'LAC', name: 'Clippers', city: 'LA' },
    { id: '1610612747', espnId: '13', tricode: 'LAL', name: 'Lakers', city: 'Los Angeles' },
    { id: '1610612756', espnId: '21', tricode: 'PHX', name: 'Suns', city: 'Phoenix' },
    { id: '1610612758', espnId: '23', tricode: 'SAC', name: 'Kings', city: 'Sacramento' },
    
    // Southwest Division
    { id: '1610612742', espnId: '6', tricode: 'DAL', name: 'Mavericks', city: 'Dallas' },
    { id: '1610612745', espnId: '10', tricode: 'HOU', name: 'Rockets', city: 'Houston' },
    { id: '1610612763', espnId: '29', tricode: 'MEM', name: 'Grizzlies', city: 'Memphis' },
    { id: '1610612740', espnId: '3', tricode: 'NOP', name: 'Pelicans', city: 'New Orleans' },
    { id: '1610612759', espnId: '24', tricode: 'SAS', name: 'Spurs', city: 'San Antonio' }
  ];
  
  constructor() {
    super('NBA');
  }
  
  protected getSportType(): string {
    return 'nba';
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
      
      // 2. Collect all players using ESPN API
      await this.collectAllPlayersFromESPN();
      
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
        // Check if team exists in cache
        const cacheKey = `team_nba_${team.name}`;
        if (this.cache.get(cacheKey)) {
          console.log(chalk.gray(`  ${team.name} already exists (cached)`));
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
          console.log(chalk.gray(`  ${team.name} already exists`));
          continue;
        }
        
        // Create new team
        const { data, error } = await this.supabase
          .from('teams')
          .insert({
            external_id: `espn_nba_${team.espnId}`,
            name: team.name,
            city: team.city,
            abbreviation: team.tricode,
            sport_id: 'nba',
            league_id: 'nba',
            logo_url: `https://a.espncdn.com/i/teamlogos/nba/500/${team.tricode.toLowerCase()}.png`
          })
          .select('id')
          .single();
        
        if (error) {
          console.error(`Error creating team ${team.name}:`, error);
        } else if (data) {
          created++;
          this.cache.set(cacheKey, data.id);
          console.log(chalk.green(`  ✓ Created ${team.name}`));
        }
        
      } catch (error) {
        console.error(`Error saving team ${team.name}:`, error);
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.NBA_TEAMS.length} teams (${created} new)`));
  }
  
  /**
   * Collect all NBA players using ESPN API
   */
  private async collectAllPlayersFromESPN(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting NBA players from ESPN...\n'));
    
    let totalPlayers = 0;
    
    for (const team of this.NBA_TEAMS) {
      try {
        console.log(chalk.gray(`\nCollecting ${team.city} ${team.name} roster...`));
        
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.espnId}/roster`;
        const response = await axios.get(url);
        
        if (response.data?.athletes) {
          const athletes = response.data.athletes;
          console.log(chalk.gray(`  Found ${athletes.length} players`));
          
          // Get team_id from database or cache
          const cacheKey = `team_nba_${team.name}`;
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
              console.error(chalk.red(`  Could not find team_id for ${team.name}`));
              continue;
            }
          }
          
          for (const player of athletes) {
            await this.processESPNPlayer(player, teamId, team);
            totalPlayers++;
          }
        }
        
        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, this.getApiDelay()));
        
      } catch (error: any) {
        console.error(chalk.red(`Error collecting ${team.fullName}:`), error.message);
      }
    }
    
    console.log(chalk.green(`\n✓ Collected ${totalPlayers} NBA players total`));
  }
  
  /**
   * Process ESPN player data
   */
  private async processESPNPlayer(player: any, teamId: number, team: NBATeam): Promise<void> {
    try {
      // Skip if missing required data
      if (!player.firstName || !player.lastName || !player.id) return;
      
      // Convert height from inches to feet and inches if needed
      let heightInches = null;
      if (player.height) {
        heightInches = parseInt(player.height);
      }
      
      const playerData = {
        external_id: `espn_nba_${player.id}`,
        firstname: player.firstName,
        lastname: player.lastName,
        name: player.fullName || `${player.firstName} ${player.lastName}`,
        sport: 'basketball',
        sport_id: 'nba',
        position: player.position?.abbreviation ? [player.position.abbreviation] : [],
        team_id: teamId,
        jersey_number: player.jersey ? parseInt(player.jersey) : null,
        heightinches: heightInches,
        weightlbs: player.weight ? parseInt(player.weight) : null,
        birthdate: player.dateOfBirth || null,
        status: player.status?.type === 'active' ? 'active' : 'inactive',
        photo_url: player.headshot?.href || null,
        team: team.name,
        team_abbreviation: team.tricode,
        metadata: {
          espn_id: player.id,
          experience: player.experience?.years || 0,
          college: player.college?.name || null
        }
      };
      
      const playerId = await this.upsertPlayer(playerData);
      if (playerId) {
        this.stats.playersCreated++;
      }
      
    } catch (error) {
      console.error(`Error processing player ${player.firstName} ${player.lastName}:`, error);
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

// Export for use in other scripts
export default NBAMasterCollector;