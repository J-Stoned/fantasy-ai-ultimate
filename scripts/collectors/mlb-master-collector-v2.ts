/**
 * ⚾ MLB MASTER COLLECTOR V2
 * Updated to use full team names and match database schema
 */

import { BaseCollector } from './base-collector';
import axios from 'axios';
import chalk from 'chalk';

interface MLBTeam {
  id: number;
  name: string;
  fullName: string;
  abbreviation: string;
  city: string;
  locationName: string;
  league: string;
  division: string;
}

export class MLBMasterCollector extends BaseCollector {
  private readonly BASE_URL = 'https://statsapi.mlb.com/api/v1';
  private teamCache: Map<number, any> = new Map();
  
  constructor() {
    super({
      batchSize: 50,
      concurrentLimit: 3,
      retryAttempts: 3,
      retryDelay: 2000
    });
  }
  
  protected getSportType(): string {
    return 'mlb';
  }
  
  protected getApiDelay(): number {
    return 1000; // 1 second between API calls
  }
  
  /**
   * Main collection process
   */
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n⚾ MLB Master Collector V2 Starting...\n'));
    
    try {
      // 1. Collect all teams with full names
      await this.collectAllTeams();
      
      // 2. Collect players for each team
      await this.collectAllPlayers();
      
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
   * Collect all MLB teams
   */
  private async collectAllTeams(): Promise<void> {
    console.log(chalk.yellow('\n📋 Collecting MLB teams...\n'));
    
    try {
      const response = await axios.get(`${this.BASE_URL}/teams?sportId=1`);
      const teams = response.data.teams || [];
      
      console.log(chalk.gray(`Found ${teams.length} teams from API\n`));
      
      let created = 0;
      for (const team of teams) {
        // Skip inactive teams
        if (!team.active) continue;
        
        // Cache team data for player collection
        this.teamCache.set(team.id, team);
        
        // Use full team name (e.g., "New York Yankees")
        // Handle special cases like Athletics where franchiseName == teamName
        let fullName: string;
        if (team.franchiseName === team.teamName) {
          // For teams like Athletics, just use locationName + teamName
          fullName = team.locationName ? `${team.locationName} ${team.teamName}` : team.teamName;
        } else if (team.name) {
          // Use the API's name field which should be complete
          fullName = team.name;
        } else {
          fullName = `${team.franchiseName} ${team.teamName}`.trim();
        }
        
        // Check if team exists
        const cacheKey = `team_mlb_${fullName}`;
        if (this.cache.get(cacheKey)) {
          console.log(chalk.gray(`  ${fullName} already exists (cached)`));
          continue;
        }
        
        // Check database
        const { data: existingTeam } = await this.supabase
          .from('teams')
          .select('id')
          .eq('external_id', `mlb_${team.id}`)
          .single();
        
        if (existingTeam) {
          this.cache.set(cacheKey, existingTeam.id);
          console.log(chalk.gray(`  ${fullName} already exists`));
          continue;
        }
        
        // Create new team
        const { data, error } = await this.supabase
          .from('teams')
          .insert({
            external_id: `mlb_${team.id}`,
            name: fullName,
            city: team.locationName || team.franchiseName,
            abbreviation: team.abbreviation,
            sport_id: 'mlb',
            league_id: 'mlb',
            logo_url: `https://www.mlbstatic.com/team-logos/${team.id}.svg`,
            metadata: {
              league: team.league.name,
              division: team.division.name,
              venue: team.venue?.name,
              mlb_id: team.id
            }
          })
          .select('id')
          .single();
        
        if (error) {
          console.error(chalk.red(`  Error creating ${fullName}:`), error.message);
        } else if (data) {
          created++;
          this.cache.set(cacheKey, data.id);
          console.log(chalk.green(`  ✓ Created ${fullName}`));
        }
      }
      
      console.log(chalk.green(`\n✓ Collected ${teams.length} teams (${created} new)`));
      
    } catch (error) {
      console.error(chalk.red('Error collecting teams:'), error);
      throw error;
    }
  }
  
  /**
   * Collect all MLB players
   */
  private async collectAllPlayers(): Promise<void> {
    console.log(chalk.yellow('\n👥 Collecting MLB players...\n'));
    
    let totalPlayers = 0;
    
    // Process each team
    for (const [teamId, teamData] of this.teamCache.entries()) {
      // Use same logic as team creation
      let fullName: string;
      if (teamData.franchiseName === teamData.teamName) {
        fullName = teamData.locationName ? `${teamData.locationName} ${teamData.teamName}` : teamData.teamName;
      } else if (teamData.name) {
        fullName = teamData.name;
      } else {
        fullName = `${teamData.franchiseName} ${teamData.teamName}`.trim();
      }
      
      try {
        console.log(chalk.gray(`\nCollecting ${fullName} roster...`));
        
        // Get 40-man roster
        const response = await axios.get(`${this.BASE_URL}/teams/${teamId}/roster/40Man`);
        const roster = response.data.roster || [];
        
        console.log(chalk.gray(`  Found ${roster.length} players`));
        
        // Get team_id from database
        const cacheKey = `team_mlb_${fullName}`;
        let dbTeamId = this.cache.get(cacheKey);
        
        if (!dbTeamId) {
          const { data: teamRecord } = await this.supabase
            .from('teams')
            .select('id')
            .eq('external_id', `mlb_${teamId}`)
            .single();
          
          if (teamRecord) {
            dbTeamId = teamRecord.id;
            this.cache.set(cacheKey, dbTeamId);
          } else {
            console.error(chalk.red(`  Could not find team_id for ${fullName}`));
            continue;
          }
        }
        
        // Process each player
        for (const player of roster) {
          await this.processMLBPlayer(player, dbTeamId, teamData);
          totalPlayers++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.getApiDelay()));
        
      } catch (error: any) {
        console.error(chalk.red(`Error collecting ${fullName}:`), error.message);
      }
    }
    
    console.log(chalk.green(`\n✓ Collected ${totalPlayers} MLB players total`));
  }
  
  /**
   * Process individual MLB player
   */
  private async processMLBPlayer(player: any, teamId: number, teamData: any): Promise<void> {
    try {
      const person = player.person;
      
      // Skip if missing required data
      if (!person?.id || !person?.fullName) return;
      
      // Get additional player details
      const playerDetails = await this.getPlayerDetails(person.id);
      
      const playerData = {
        external_id: `mlb_${person.id}`,
        firstname: playerDetails?.firstName || person.fullName.split(' ')[0],
        lastname: playerDetails?.lastName || person.fullName.split(' ').slice(1).join(' '),
        name: person.fullName,
        sport: 'baseball',
        sport_id: 'mlb',
        position: player.position ? [player.position.abbreviation] : [],
        team_id: teamId,
        jersey_number: player.jerseyNumber ? parseInt(player.jerseyNumber) : null,
        heightinches: this.parseHeight(playerDetails?.height),
        weightlbs: playerDetails?.weight ? parseInt(playerDetails.weight) : null,
        birthdate: playerDetails?.birthDate || null,
        status: player.status?.code === 'A' ? 'active' : 'inactive',
        photo_url: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${person.id}/headshot/67/current`,
        team: fullName,
        team_abbreviation: teamData.abbreviation,
        metadata: {
          mlb_id: person.id,
          birth_city: playerDetails?.birthCity,
          birth_state: playerDetails?.birthStateProvince,
          birth_country: playerDetails?.birthCountry,
          debut_date: playerDetails?.mlbDebutDate,
          bat_side: playerDetails?.batSide?.code,
          pitch_hand: playerDetails?.pitchHand?.code
        }
      };
      
      await this.upsertPlayer(playerData);
      
    } catch (error) {
      console.error(`Error processing player ${player.person?.fullName}:`, error);
    }
  }
  
  /**
   * Get additional player details
   */
  private async getPlayerDetails(playerId: number): Promise<any | null> {
    try {
      const response = await axios.get(`${this.BASE_URL}/people/${playerId}`);
      return response.data.people?.[0] || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Parse height from feet-inches format (e.g., "6' 3\"")
   */
  private parseHeight(height?: string): number | null {
    if (!height) return null;
    
    const match = height.match(/(\d+)'\s*(\d+)"/);
    if (match) {
      const feet = parseInt(match[1]);
      const inches = parseInt(match[2]);
      return feet * 12 + inches;
    }
    
    return null;
  }
}

// Export for use in scripts
export default MLBMasterCollector;