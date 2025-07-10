#!/usr/bin/env tsx
/**
 * MASSIVE DATA COLLECTOR
 * Gets years of historical data from multiple sources
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';
import pLimit from 'p-limit';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Rate limiting
const limit = pLimit(5);

class MassiveDataCollector {
  private stats = {
    nfl: { games: 0, seasons: [] as number[] },
    nba: { games: 0, seasons: [] as number[] },
    mlb: { games: 0, seasons: [] as number[] },
    nhl: { games: 0, seasons: [] as number[] },
    ncaaf: { games: 0, seasons: [] as number[] },
    ncaab: { games: 0, seasons: [] as number[] }
  };
  
  async collectMassiveData() {
    console.log(chalk.blue.bold('🚀 MASSIVE DATA COLLECTION STRATEGY\n'));
    console.log(chalk.yellow('This will collect YEARS of historical data!\n'));
    
    // Strategy 1: Historical seasons
    await this.collectHistoricalNFL();
    await this.collectHistoricalNBA();
    await this.collectHistoricalMLB();
    await this.collectHistoricalNHL();
    
    // Strategy 2: More college data
    await this.collectMoreNCAA();
    
    // Strategy 3: International sports
    await this.collectInternational();
    
    // Show massive results
    this.showMassiveResults();
  }
  
  private async collectHistoricalNFL() {
    console.log(chalk.cyan('🏈 NFL Historical Data (2020-2024)...'));
    
    const seasons = [2020, 2021, 2022, 2023, 2024];
    
    for (const year of seasons) {
      let seasonGames = 0;
      
      // Regular season (17-18 weeks depending on year)
      const weeks = year >= 2021 ? 18 : 17;
      
      for (let week = 1; week <= weeks; week++) {
        try {
          const response = await limit(() => 
            axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${year}`)
          );
          
          const events = response.data.events || [];
          
          for (const event of events) {
            if (event.status?.type?.completed && await this.saveGame('nfl', event, year, week)) {
              seasonGames++;
              this.stats.nfl.games++;
            }
          }
          
        } catch (error) {
          // Skip errors
        }
      }
      
      // Playoffs
      for (let week = 1; week <= 5; week++) {
        try {
          const response = await limit(() =>
            axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=3&week=${week}&dates=${year}`)
          );
          
          const events = response.data.events || [];
          
          for (const event of events) {
            if (event.status?.type?.completed && await this.saveGame('nfl', event, year, 18 + week)) {
              seasonGames++;
              this.stats.nfl.games++;
            }
          }
          
        } catch (error) {
          // Skip
        }
      }
      
      if (seasonGames > 0) {
        this.stats.nfl.seasons.push(year);
        console.log(`   ${year}: ${seasonGames} games`);
      }
    }
  }
  
  private async collectHistoricalNBA() {
    console.log(chalk.cyan('\n🏀 NBA Historical Data (2020-2025)...'));
    
    const seasons = [
      { year: '2020-21', dates: ['20201222-20210131', '20210201-20210228', '20210301-20210331', '20210401-20210430', '20210501-20210531'] },
      { year: '2021-22', dates: ['20211019-20211130', '20211201-20211231', '20220101-20220131', '20220201-20220228', '20220301-20220331'] },
      { year: '2022-23', dates: ['20221018-20221130', '20221201-20221231', '20230101-20230131', '20230201-20230228', '20230301-20230331'] },
      { year: '2023-24', dates: ['20231024-20231130', '20231201-20231231', '20240101-20240131', '20240201-20240229', '20240301-20240331'] },
      { year: '2024-25', dates: ['20241022-20241130', '20241201-20241231', '20250101-20250131'] }
    ];
    
    for (const season of seasons) {
      let seasonGames = 0;
      
      for (const dateRange of season.dates) {
        try {
          const response = await limit(() =>
            axios.get(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateRange}&limit=1000`)
          );
          
          const events = response.data.events || [];
          
          for (const event of events) {
            if (event.status?.type?.completed && await this.saveGame('nba', event, parseInt(season.year))) {
              seasonGames++;
              this.stats.nba.games++;
            }
          }
          
        } catch (error) {
          // Skip
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (seasonGames > 0) {
        console.log(`   ${season.year}: ${seasonGames} games`);
      }
    }
  }
  
  private async collectHistoricalMLB() {
    console.log(chalk.cyan('\n⚾ MLB Historical Data (2022-2024)...'));
    
    const years = [2022, 2023, 2024];
    
    for (const year of years) {
      let yearGames = 0;
      
      // Sample throughout the season (April-October)
      const months = [4, 5, 6, 7, 8, 9, 10];
      
      for (const month of months) {
        // Get 4 sample dates per month
        const dates = [5, 10, 15, 20, 25].map(day => 
          `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`
        );
        
        for (const date of dates) {
          try {
            const response = await limit(() =>
              axios.get(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`)
            );
            
            const events = response.data.events || [];
            
            for (const event of events) {
              if (event.status?.type?.completed && await this.saveGame('mlb', event, year)) {
                yearGames++;
                this.stats.mlb.games++;
              }
            }
            
          } catch (error) {
            // Skip
          }
        }
        
        process.stdout.write(`\r   ${year}: ${yearGames} games...`);
      }
      
      if (yearGames > 0) {
        this.stats.mlb.seasons.push(year);
        console.log(`\r   ${year}: ${yearGames} games    `);
      }
    }
  }
  
  private async collectHistoricalNHL() {
    console.log(chalk.cyan('\n🏒 NHL Historical Data (2021-2025)...'));
    
    const seasons = [
      { year: '2021-22', months: ['202110', '202111', '202112', '202201', '202202', '202203'] },
      { year: '2022-23', months: ['202210', '202211', '202212', '202301', '202302', '202303'] },
      { year: '2023-24', months: ['202310', '202311', '202312', '202401', '202402', '202403'] },
      { year: '2024-25', months: ['202410', '202411', '202412', '202501'] }
    ];
    
    for (const season of seasons) {
      let seasonGames = 0;
      
      for (const month of season.months) {
        try {
          const response = await limit(() =>
            axios.get(`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${month}01-${month}31`)
          );
          
          const events = response.data.events || [];
          
          for (const event of events) {
            if (event.status?.type?.completed && await this.saveGame('nhl', event, parseInt(season.year))) {
              seasonGames++;
              this.stats.nhl.games++;
            }
          }
          
        } catch (error) {
          // Skip
        }
      }
      
      if (seasonGames > 0) {
        console.log(`   ${season.year}: ${seasonGames} games`);
      }
    }
  }
  
  private async collectMoreNCAA() {
    console.log(chalk.cyan('\n🎓 NCAA Extended Collection...'));
    
    // More NCAA Football
    console.log('   NCAA Football bowl games...');
    let bowlGames = 0;
    
    try {
      // Bowl season
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&dates=20231215-20240108&limit=150'
      );
      
      const events = response.data.events || [];
      
      for (const event of events) {
        if (event.status?.type?.completed && event.name.includes('Bowl')) {
          if (await this.saveGame('ncaaf', event, 2023)) {
            bowlGames++;
            this.stats.ncaaf.games++;
          }
        }
      }
      
      console.log(`     Added ${bowlGames} bowl games`);
      
    } catch (error) {
      // Skip
    }
    
    // March Madness
    console.log('   NCAA Basketball March Madness...');
    let tourneyGames = 0;
    
    try {
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20240314-20240408&limit=100'
      );
      
      const events = response.data.events || [];
      
      for (const event of events) {
        if (event.status?.type?.completed && await this.saveGame('ncaab', event, 2024)) {
          tourneyGames++;
          this.stats.ncaab.games++;
        }
      }
      
      console.log(`     Added ${tourneyGames} tournament games`);
      
    } catch (error) {
      // Skip
    }
  }
  
  private async collectInternational() {
    console.log(chalk.cyan('\n🌍 International Sports...'));
    
    // Premier League
    console.log('   Premier League soccer...');
    let soccerGames = 0;
    
    try {
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20240801-20240831'
      );
      
      const events = response.data.events || [];
      
      for (const event of events.slice(0, 50)) {
        if (event.status?.type?.completed) {
          soccerGames++;
        }
      }
      
      console.log(`     Found ${soccerGames} games (not saved - different schema)`);
      
    } catch (error) {
      // Skip
    }
  }
  
  private async saveGame(sport: string, event: any, year?: number, week?: number): Promise<boolean> {
    try {
      const comp = event.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!home || !away) return false;
      
      // First ensure teams exist
      await this.ensureTeamExists(home.team, sport);
      await this.ensureTeamExists(away.team, sport);
      
      // Validate and clean data
      const homeScore = parseInt(home.score) || 0;
      const awayScore = parseInt(away.score) || 0;
      
      // Skip if invalid scores (both 0 might mean game not played)
      if (homeScore === 0 && awayScore === 0 && comp.status?.type?.completed) {
        return false;
      }
      
      const gameData = {
        home_team_id: parseInt(home.team.id),
        away_team_id: parseInt(away.team.id),
        sport_id: sport,
        start_time: event.date,
        venue: comp.venue?.fullName || event.name || 'Unknown Venue',
        home_score: homeScore,
        away_score: awayScore,
        status: 'completed',
        external_id: `${sport}_${event.id}`,
        metadata: {
          season: year || new Date(event.date).getFullYear(),
          week: week,
          attendance: comp.attendance,
          playoffs: event.seasonType === 3,
          broadcast: comp.broadcasts?.[0]?.names?.[0]
        }
      };
      
      const { error } = await supabase
        .from('games')
        .upsert(gameData, { onConflict: 'external_id' });
        
      return !error;
      
    } catch (error) {
      return false;
    }
  }
  
  private async ensureTeamExists(teamData: any, sport: string) {
    const teamId = parseInt(teamData.id);
    
    // Check if team exists
    const { data: exists } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single();
    
    if (!exists) {
      const team = {
        id: teamId,
        name: teamData.displayName || teamData.name || `Team ${teamId}`,
        abbreviation: teamData.abbreviation || `T${teamId}`,
        location: teamData.location || '',
        sport: sport,
        espn_id: teamData.id
      };
      
      await supabase.from('teams').insert(team);
    }
  }
  
  private showMassiveResults() {
    console.log(chalk.green.bold('\n\n🎉 MASSIVE DATA COLLECTION COMPLETE!\n'));
    
    let totalGames = 0;
    
    Object.entries(this.stats).forEach(([sport, data]) => {
      if (data.games > 0) {
        console.log(chalk.cyan(`${sport.toUpperCase()}:`));
        console.log(`  Games: ${data.games}`);
        if (data.seasons.length > 0) {
          console.log(`  Seasons: ${data.seasons.join(', ')}`);
        }
        totalGames += data.games;
      }
    });
    
    console.log(chalk.yellow.bold(`\n🚀 TOTAL NEW GAMES: ${totalGames.toLocaleString()}`));
    console.log(chalk.green('\nYour database now has YEARS of historical data!'));
    
    // More data sources
    console.log(chalk.blue.bold('\n📚 EVEN MORE DATA SOURCES:\n'));
    console.log('1. Sports Reference sites (basketball-reference.com, pro-football-reference.com)');
    console.log('2. Kaggle datasets (search "nfl data", "nba data")');
    console.log('3. GitHub sports data repositories');
    console.log('4. Official league APIs (NBA.com, NFL.com)');
    console.log('5. Sports betting APIs (with historical odds)');
    console.log('6. Weather data APIs (for outdoor sports)');
    console.log('7. Player stats APIs (injuries, performance)');
    console.log('8. Social media sentiment (Twitter/X API)');
  }
}

// Run it!
const collector = new MassiveDataCollector();
collector.collectMassiveData().catch(console.error);