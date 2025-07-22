#!/usr/bin/env tsx
/**
 * 🔧 COLLECTION WORKER - Runs in separate thread
 * 
 * Handles API calls and data processing
 */

import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { format } from 'date-fns';

interface WorkerTask {
  type: 'collect_teams' | 'collect_games' | 'collect_players' | 'collect_stats';
  sport: string;
  season: string | number;
  api: string;
  data?: any;
}

class CollectionWorker {
  private apis = {
    espn: {
      nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
      nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
      mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb',
      nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl',
      ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball',
      ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football'
    },
    mlb_stats: 'https://statsapi.mlb.com/api/v1',
    yahoo: {
      base: 'https://sports.yahoo.com'
    }
  };
  
  async processTask(task: WorkerTask): Promise<any> {
    switch (task.type) {
      case 'collect_teams':
        return this.collectTeams(task);
      case 'collect_games':
        return this.collectGames(task);
      case 'collect_players':
        return this.collectPlayers(task);
      case 'collect_stats':
        return this.collectStats(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }
  
  /**
   * Collect teams for a sport/season
   */
  async collectTeams(task: WorkerTask): Promise<any[]> {
    const teams: any[] = [];
    
    if (task.api === 'espn' && this.apis.espn[task.sport]) {
      const url = `${this.apis.espn[task.sport]}/teams?limit=500`;
      const response = await axios.get(url);
      
      if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
        for (const teamData of response.data.sports[0].leagues[0].teams) {
          const team = teamData.team;
          teams.push({
            our_team_id: `${task.sport}_${team.id}`,
            sport: task.sport.toUpperCase(),
            league: this.getLeague(task.sport),
            name: team.displayName,
            city: team.location,
            abbreviation: team.abbreviation,
            espn_id: team.id,
            venue_name: team.venue?.fullName,
            conference: team.groups?.name,
            division: team.division?.name
          });
        }
      }
    } else if (task.api === 'mlb' && task.sport === 'mlb') {
      // MLB Stats API
      const url = `${this.apis.mlb_stats}/teams?sportId=1&season=${task.season}`;
      const response = await axios.get(url);
      
      for (const team of response.data.teams || []) {
        teams.push({
          our_team_id: `mlb_${team.id}`,
          sport: 'MLB',
          league: 'MLB',
          name: team.name,
          city: team.locationName,
          abbreviation: team.abbreviation,
          mlb_api_id: team.id.toString(),
          venue_name: team.venue?.name,
          division: team.division?.name
        });
      }
    }
    
    return teams;
  }
  
  /**
   * Collect games for a sport/season
   */
  async collectGames(task: WorkerTask): Promise<any[]> {
    const games: any[] = [];
    
    if (task.api === 'espn' && this.apis.espn[task.sport]) {
      // ESPN scoreboard API
      const dates = this.getSeasonDates(task.sport, task.season);
      
      for (const date of dates) {
        const dateStr = format(date, 'yyyyMMdd');
        const url = `${this.apis.espn[task.sport]}/scoreboard?dates=${dateStr}&limit=500`;
        
        try {
          const response = await axios.get(url);
          
          for (const event of response.data.events || []) {
            const competition = event.competitions?.[0];
            if (!competition) continue;
            
            const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
            
            games.push({
              our_game_id: `${task.sport}_${event.id}`,
              sport: task.sport.toUpperCase(),
              league: this.getLeague(task.sport),
              season: task.season,
              game_date: event.date,
              home_team_id: homeTeam?.team?.id,
              away_team_id: awayTeam?.team?.id,
              home_score: parseInt(homeTeam?.score || '0'),
              away_score: parseInt(awayTeam?.score || '0'),
              status: event.status?.type?.name,
              venue: competition.venue?.fullName,
              attendance: competition.attendance,
              espn_game_id: event.id,
              weather: this.parseWeather(competition.weather)
            });
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error fetching games for ${dateStr}:`, error);
        }
      }
    }
    
    return games;
  }
  
  /**
   * Collect players for teams
   */
  async collectPlayers(task: WorkerTask): Promise<any[]> {
    const players: any[] = [];
    
    if (task.api === 'espn' && task.data?.team_id) {
      const url = `${this.apis.espn[task.sport]}/teams/${task.data.team_id}/roster`;
      
      try {
        const response = await axios.get(url);
        
        for (const athlete of response.data.athletes || []) {
          players.push({
            our_player_id: `${task.sport}_${athlete.id}`,
            sport: task.sport.toUpperCase(),
            name: athlete.fullName,
            first_name: athlete.firstName,
            last_name: athlete.lastName,
            position: athlete.position?.abbreviation,
            jersey_number: athlete.jersey,
            height: athlete.displayHeight,
            weight: athlete.displayWeight,
            birth_date: athlete.dateOfBirth,
            college: athlete.college?.name,
            years_pro: athlete.experience?.years,
            status: athlete.status?.type?.name,
            team_id: task.data.team_id,
            espn_id: athlete.id,
            headshot_url: athlete.headshot?.href
          });
        }
      } catch (error) {
        console.error(`Error fetching roster for team ${task.data.team_id}:`, error);
      }
    }
    
    return players;
  }
  
  /**
   * Collect game stats
   */
  async collectStats(task: WorkerTask): Promise<any[]> {
    const stats: any[] = [];
    
    if (task.api === 'espn' && task.data?.game_id) {
      const url = `${this.apis.espn[task.sport]}/summary?event=${task.data.game_id}`;
      
      try {
        const response = await axios.get(url);
        
        // Parse box score based on sport
        if (task.sport === 'nfl') {
          stats.push(...this.parseNFLStats(response.data));
        } else if (task.sport === 'nba') {
          stats.push(...this.parseNBAStats(response.data));
        } else if (task.sport === 'mlb') {
          stats.push(...this.parseMLBStats(response.data));
        } else if (task.sport === 'nhl') {
          stats.push(...this.parseNHLStats(response.data));
        }
      } catch (error) {
        console.error(`Error fetching stats for game ${task.data.game_id}:`, error);
      }
    }
    
    return stats;
  }
  
  // Helper methods
  private getLeague(sport: string): string {
    const leagueMap = {
      nfl: 'NFL',
      nba: 'NBA',
      mlb: 'MLB',
      nhl: 'NHL',
      ncaab: 'NCAA_BB',
      ncaaf: 'NCAA_FB'
    };
    return leagueMap[sport] || sport.toUpperCase();
  }
  
  private getSeasonDates(sport: string, season: number): Date[] {
    const dates: Date[] = [];
    // This would return array of dates for the season
    // Simplified for example
    return dates;
  }
  
  private parseWeather(weather: any): any {
    if (!weather) return null;
    return {
      temp: weather.temperature,
      wind: weather.displayValue,
      conditions: weather.highTemperature
    };
  }
  
  private parseNFLStats(data: any): any[] {
    // Parse NFL box score
    return [];
  }
  
  private parseNBAStats(data: any): any[] {
    // Parse NBA box score
    return [];
  }
  
  private parseMLBStats(data: any): any[] {
    // Parse MLB box score
    return [];
  }
  
  private parseNHLStats(data: any): any[] {
    // Parse NHL box score
    return [];
  }
}

// Worker thread execution
if (parentPort) {
  const worker = new CollectionWorker();
  
  parentPort.on('message', async (task: WorkerTask) => {
    try {
      const result = await worker.processTask(task);
      parentPort!.postMessage({ success: true, data: result });
    } catch (error: any) {
      parentPort!.postMessage({ success: false, error: error.message });
    }
  });
}