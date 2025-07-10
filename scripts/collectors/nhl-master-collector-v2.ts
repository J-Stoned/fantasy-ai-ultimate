/**
 * 🏒 NHL MASTER COLLECTOR V2
 * Uses ESPN API with full team names
 */

import { BaseCollector } from './base-collector';
import axios from 'axios';
import chalk from 'chalk';

interface NHLTeam {
  id: string;
  espnId: string;
  name: string;
  fullName: string;
  abbreviation: string;
  city: string;
}

export class NHLMasterCollector extends BaseCollector {
  private readonly NHL_TEAMS: NHLTeam[] = [
    // Atlantic Division
    { id: '1', espnId: '1', name: 'Bruins', fullName: 'Boston Bruins', abbreviation: 'BOS', city: 'Boston' },
    { id: '2', espnId: '2', name: 'Sabres', fullName: 'Buffalo Sabres', abbreviation: 'BUF', city: 'Buffalo' },
    { id: '5', espnId: '5', name: 'Red Wings', fullName: 'Detroit Red Wings', abbreviation: 'DET', city: 'Detroit' },
    { id: '26', espnId: '26', name: 'Panthers', fullName: 'Florida Panthers', abbreviation: 'FLA', city: 'Florida' },
    { id: '10', espnId: '10', name: 'Canadiens', fullName: 'Montreal Canadiens', abbreviation: 'MTL', city: 'Montreal' },
    { id: '14', espnId: '14', name: 'Senators', fullName: 'Ottawa Senators', abbreviation: 'OTT', city: 'Ottawa' },
    { id: '20', espnId: '20', name: 'Lightning', fullName: 'Tampa Bay Lightning', abbreviation: 'TB', city: 'Tampa Bay' },
    { id: '21', espnId: '21', name: 'Maple Leafs', fullName: 'Toronto Maple Leafs', abbreviation: 'TOR', city: 'Toronto' },
    
    // Metropolitan Division
    { id: '7', espnId: '7', name: 'Hurricanes', fullName: 'Carolina Hurricanes', abbreviation: 'CAR', city: 'Carolina' },
    { id: '29', espnId: '29', name: 'Blue Jackets', fullName: 'Columbus Blue Jackets', abbreviation: 'CBJ', city: 'Columbus' },
    { id: '11', espnId: '11', name: 'Devils', fullName: 'New Jersey Devils', abbreviation: 'NJ', city: 'New Jersey' },
    { id: '12', espnId: '12', name: 'Islanders', fullName: 'New York Islanders', abbreviation: 'NYI', city: 'New York' },
    { id: '13', espnId: '13', name: 'Rangers', fullName: 'New York Rangers', abbreviation: 'NYR', city: 'New York' },
    { id: '15', espnId: '15', name: 'Flyers', fullName: 'Philadelphia Flyers', abbreviation: 'PHI', city: 'Philadelphia' },
    { id: '16', espnId: '16', name: 'Penguins', fullName: 'Pittsburgh Penguins', abbreviation: 'PIT', city: 'Pittsburgh' },
    { id: '23', espnId: '23', name: 'Capitals', fullName: 'Washington Capitals', abbreviation: 'WSH', city: 'Washington' },
    
    // Central Division
    { id: '4', espnId: '4', name: 'Blackhawks', fullName: 'Chicago Blackhawks', abbreviation: 'CHI', city: 'Chicago' },
    { id: '17', espnId: '17', name: 'Avalanche', fullName: 'Colorado Avalanche', abbreviation: 'COL', city: 'Colorado' },
    { id: '9', espnId: '9', name: 'Stars', fullName: 'Dallas Stars', abbreviation: 'DAL', city: 'Dallas' },
    { id: '30', espnId: '30', name: 'Wild', fullName: 'Minnesota Wild', abbreviation: 'MIN', city: 'Minnesota' },
    { id: '27', espnId: '27', name: 'Predators', fullName: 'Nashville Predators', abbreviation: 'NSH', city: 'Nashville' },
    { id: '19', espnId: '19', name: 'Blues', fullName: 'St. Louis Blues', abbreviation: 'STL', city: 'St. Louis' },
    { id: '129764', espnId: '129764', name: 'Mammoth', fullName: 'Utah Mammoth', abbreviation: 'UTA', city: 'Utah' },
    { id: '28', espnId: '28', name: 'Jets', fullName: 'Winnipeg Jets', abbreviation: 'WPG', city: 'Winnipeg' },
    
    // Pacific Division
    { id: '25', espnId: '25', name: 'Ducks', fullName: 'Anaheim Ducks', abbreviation: 'ANA', city: 'Anaheim' },
    { id: '3', espnId: '3', name: 'Flames', fullName: 'Calgary Flames', abbreviation: 'CGY', city: 'Calgary' },
    { id: '6', espnId: '6', name: 'Oilers', fullName: 'Edmonton Oilers', abbreviation: 'EDM', city: 'Edmonton' },
    { id: '8', espnId: '8', name: 'Kings', fullName: 'Los Angeles Kings', abbreviation: 'LA', city: 'Los Angeles' },
    { id: '18', espnId: '18', name: 'Sharks', fullName: 'San Jose Sharks', abbreviation: 'SJ', city: 'San Jose' },
    { id: '124292', espnId: '124292', name: 'Kraken', fullName: 'Seattle Kraken', abbreviation: 'SEA', city: 'Seattle' },
    { id: '22', espnId: '22', name: 'Canucks', fullName: 'Vancouver Canucks', abbreviation: 'VAN', city: 'Vancouver' },
    { id: '37', espnId: '37', name: 'Golden Knights', fullName: 'Vegas Golden Knights', abbreviation: 'VGK', city: 'Vegas' }
  ];
  
  constructor() {
    super({
      batchSize: 50,
      concurrentLimit: 3,
      retryAttempts: 3,
      retryDelay: 2000
    });
  }
  
  protected getSportType(): string {
    return 'nhl';
  }
  
  protected getApiDelay(): number {
    return 1500; // 1.5 seconds between API calls
  }
  
  /**
   * Main collection process
   */
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🏒 NHL Master Collector V2 Starting...\n'));
    
    try {
      // 1. Collect all teams with full names
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
   * Collect all NHL teams
   */
  private async collectAllTeams(): Promise<void> {
    console.log(chalk.yellow('\n📋 Collecting NHL teams...\n'));
    
    let created = 0;
    for (const team of this.NHL_TEAMS) {
      try {
        // Check if team exists in cache
        const cacheKey = `team_nhl_${team.fullName}`;
        if (this.cache.get(cacheKey)) {
          console.log(chalk.gray(`  ${team.fullName} already exists (cached)`));
          continue;
        }
        
        // Check if team exists in database
        const { data: existingTeam } = await this.supabase
          .from('teams')
          .select('id')
          .eq('external_id', `espn_nhl_${team.espnId}`)
          .single();
        
        if (existingTeam) {
          this.cache.set(cacheKey, existingTeam.id);
          console.log(chalk.gray(`  ${team.fullName} already exists`));
          continue;
        }
        
        // Create new team
        const { data, error } = await this.supabase
          .from('teams')
          .insert({
            external_id: `espn_nhl_${team.espnId}`,
            name: team.fullName,  // Use full name
            city: team.city,
            abbreviation: team.abbreviation,
            sport_id: 'nhl',
            league_id: 'nhl',
            logo_url: `https://a.espncdn.com/i/teamlogos/nhl/500/${team.abbreviation.toLowerCase()}.png`
          })
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
    
    console.log(chalk.green(`\n✓ Collected ${this.NHL_TEAMS.length} teams (${created} new)`));
  }
  
  /**
   * Collect all NHL players using ESPN API
   */
  private async collectAllPlayersFromESPN(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting NHL players from ESPN...\n'));
    
    let totalPlayers = 0;
    
    for (const team of this.NHL_TEAMS) {
      try {
        console.log(chalk.gray(`\nCollecting ${team.fullName} roster...`));
        
        const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${team.espnId}/roster`;
        const response = await axios.get(url);
        
        if (response.data?.athletes) {
          const positionGroups = response.data.athletes;
          
          // Get team_id from database or cache
          const cacheKey = `team_nhl_${team.fullName}`;
          let teamId = this.cache.get(cacheKey);
          
          if (!teamId) {
            const { data: teamData } = await this.supabase
              .from('teams')
              .select('id')
              .eq('external_id', `espn_nhl_${team.espnId}`)
              .single();
            
            if (teamData) {
              teamId = teamData.id;
              this.cache.set(cacheKey, teamId);
            } else {
              console.error(chalk.red(`  Could not find team_id for ${team.fullName}`));
              continue;
            }
          }
          
          // Process each position group
          let teamPlayerCount = 0;
          for (const group of positionGroups) {
            if (group.items && Array.isArray(group.items)) {
              for (const player of group.items) {
                await this.processESPNPlayer(player, teamId, team);
                teamPlayerCount++;
                totalPlayers++;
              }
            }
          }
          
          console.log(chalk.gray(`  Found ${teamPlayerCount} players`));
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.getApiDelay()));
        
      } catch (error: any) {
        console.error(chalk.red(`Error collecting ${team.fullName}:`), error.message);
      }
    }
    
    console.log(chalk.green(`\n✓ Collected ${totalPlayers} NHL players total`));
  }
  
  /**
   * Process ESPN player data
   */
  private async processESPNPlayer(player: any, teamId: number, team: NHLTeam): Promise<void> {
    try {
      // Skip if missing required data
      if (!player.firstName || !player.lastName || !player.id) return;
      
      // Convert height from inches
      let heightInches = null;
      if (player.height) {
        heightInches = parseInt(player.height);
      }
      
      const playerData = {
        external_id: `espn_nhl_${player.id}`,
        firstname: player.firstName,
        lastname: player.lastName,
        name: player.fullName || `${player.firstName} ${player.lastName}`,
        sport: 'hockey',
        sport_id: 'nhl',
        position: player.position?.abbreviation ? [player.position.abbreviation] : [],
        team_id: teamId,
        jersey_number: player.jersey ? parseInt(player.jersey) : null,
        heightinches: heightInches,
        weightlbs: player.weight ? parseInt(player.weight) : null,
        birthdate: player.dateOfBirth || null,
        status: player.status?.type === 'active' ? 'active' : 'inactive',
        photo_url: player.headshot?.href || null,
        team: team.fullName,
        team_abbreviation: team.abbreviation,
        metadata: {
          espn_id: player.id,
          experience: player.experience?.years || 0,
          birth_city: player.birthPlace?.city || null,
          birth_country: player.birthPlace?.country || null
        }
      };
      
      await this.upsertPlayer(playerData);
      
    } catch (error) {
      console.error(`Error processing player ${player.firstName} ${player.lastName}:`, error);
    }
  }
}

// Export for use in scripts
export default NHLMasterCollector;