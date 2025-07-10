#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

class UnifiedFantasyDataCollector {
  // API configurations
  private apis = {
    espn: {
      fantasy: 'https://fantasy.espn.com/apis/v3/games',
      sports: 'https://site.api.espn.com/apis/site/v2/sports',
      freeToUse: true
    },
    sleeper: {
      base: 'https://api.sleeper.app/v1',
      freeToUse: true
    },
    yahoo: {
      base: 'https://fantasysports.yahooapis.com/fantasy/v2',
      requiresAuth: true
    },
    theOddsAPI: {
      base: 'https://api.the-odds-api.com/v4',
      key: process.env.THE_ODDS_API_KEY || 'c4122ff7d8e3da9371cb8043db05bc41'
    },
    ballDontLie: {
      base: 'https://www.balldontlie.io/api/v1',
      key: process.env.BALLDONTLIE_API_KEY || '59de4292-dfc4-4a8a-b337-1e804f4109c6'
    },
    mySportsFeeds: {
      base: 'https://api.mysportsfeeds.com/v2.1',
      key: process.env.MYSPORTSFEEDS_API_KEY || '92da39aa-de1d-4c12-840b-e68e9e'
    }
  };

  async collectAllFantasyData() {
    console.log('🚀 UNIFIED FANTASY DATA COLLECTION\n');
    console.log('═'.repeat(60));
    
    try {
      // 1. ESPN Free Data (No Auth Required!)
      await this.collectESPNData();
      
      // 2. Sleeper Data (No Auth Required!)
      await this.collectSleeperData();
      
      // 3. BallDontLie NBA Data
      await this.collectNBAData();
      
      // 4. The Odds API
      await this.collectBettingData();
      
      // 5. MySportsFeeds
      await this.collectMySportsFeedsData();
      
      // 6. Yahoo (if authenticated)
      await this.collectYahooData();
      
      // Summary
      await this.generateSummary();
      
    } catch (error) {
      console.error('❌ Collection error:', error);
    }
  }

  async collectESPNData() {
    console.log('\n📊 COLLECTING ESPN DATA (FREE API)\n');
    
    try {
      // NFL Games & Scores
      const nflScores = await axios.get(
        `${this.apis.espn.sports}/football/nfl/scoreboard`,
        { params: { dates: '20241201-20241231' } }
      );
      
      if (nflScores.data.events) {
        console.log(`✅ Found ${nflScores.data.events.length} NFL games`);
        
        for (const event of nflScores.data.events.slice(0, 10)) {
          const game = {
            external_id: `espn_${event.id}`,
            home_team_id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').id,
            away_team_id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').id,
            start_time: event.date,
            home_score: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
            away_score: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
            status: event.status.type.name,
            sport_id: 'nfl'
          };
          
          // Get player stats from boxscore
          if (event.status.type.completed) {
            const boxscore = await axios.get(
              `${this.apis.espn.sports}/football/nfl/summary?event=${event.id}`
            );
            
            if (boxscore.data.boxscore) {
              console.log(`   📈 Got player stats for game ${event.id}`);
              // Process player stats here
            }
          }
        }
      }
      
      // Fantasy projections
      const fantasyUrl = `${this.apis.espn.fantasy}/ffl/seasons/2024/segments/0/leagues/0`;
      console.log('📊 Getting ESPN Fantasy projections...');
      
    } catch (error) {
      console.error('ESPN error:', error);
    }
  }

  async collectSleeperData() {
    console.log('\n📊 COLLECTING SLEEPER DATA (FREE API)\n');
    
    try {
      // Get all NFL players
      const players = await axios.get(`${this.apis.sleeper.base}/players/nfl`);
      const playerArray = Object.values(players.data);
      console.log(`✅ Found ${playerArray.length} NFL players`);
      
      // Get trending players
      const trending = await axios.get(
        `${this.apis.sleeper.base}/players/nfl/trending/add`
      );
      console.log(`📈 ${trending.data.length} trending players`);
      
      // Get NFL state (current week, etc)
      const nflState = await axios.get(`${this.apis.sleeper.base}/state/nfl`);
      console.log(`📅 Current NFL week: ${nflState.data.week}`);
      
    } catch (error) {
      console.error('Sleeper error:', error);
    }
  }

  async collectNBAData() {
    console.log('\n📊 COLLECTING NBA DATA (BALLDONTLIE)\n');
    
    try {
      // Get recent games
      const games = await axios.get(`${this.apis.ballDontLie.base}/games`, {
        params: {
          seasons: [2024],
          per_page: 100
        },
        headers: {
          'Authorization': this.apis.ballDontLie.key
        }
      });
      
      console.log(`✅ Found ${games.data.data.length} NBA games`);
      
      // Get player stats for games
      for (const game of games.data.data.slice(0, 5)) {
        if (game.status === 'Final') {
          const stats = await axios.get(`${this.apis.ballDontLie.base}/stats`, {
            params: {
              game_ids: [game.id],
              per_page: 100
            },
            headers: {
              'Authorization': this.apis.ballDontLie.key
            }
          });
          
          console.log(`   📈 Got ${stats.data.data.length} player stats for game ${game.id}`);
        }
      }
      
    } catch (error) {
      console.error('BallDontLie error:', error);
    }
  }

  async collectBettingData() {
    console.log('\n📊 COLLECTING BETTING ODDS\n');
    
    try {
      const sports = ['americanfootball_nfl', 'basketball_nba'];
      
      for (const sport of sports) {
        const odds = await axios.get(`${this.apis.theOddsAPI.base}/sports/${sport}/odds`, {
          params: {
            apiKey: this.apis.theOddsAPI.key,
            regions: 'us',
            markets: 'h2h,spreads,totals'
          }
        });
        
        console.log(`✅ ${sport}: ${odds.data.length} games with odds`);
      }
      
    } catch (error) {
      console.error('Odds API error:', error);
    }
  }

  async collectMySportsFeedsData() {
    console.log('\n📊 COLLECTING MYSPORTSFEEDS DATA\n');
    
    // This requires proper auth setup
    console.log('⚠️  MySportsFeeds requires paid subscription');
  }

  async collectYahooData() {
    console.log('\n📊 YAHOO FANTASY DATA\n');
    
    // Check if we have Yahoo auth
    const { data: connections } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('platform', 'yahoo')
      .eq('is_active', true)
      .limit(1);
    
    if (connections && connections.length > 0) {
      console.log('✅ Yahoo authenticated - can pull league data');
    } else {
      console.log('⚠️  Yahoo requires OAuth authentication');
    }
  }

  async generateSummary() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 DATA COLLECTION SUMMARY\n');
    
    const { count: games } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const { count: playerStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total games in DB: ${games}`);
    console.log(`Total player game logs: ${playerStats}`);
    
    console.log('\n🎯 RECOMMENDED APPROACH:');
    console.log('1. Use ESPN free API for NFL/NBA game data');
    console.log('2. Use Sleeper for player info and trending data');
    console.log('3. Use BallDontLie for detailed NBA stats');
    console.log('4. Use The Odds API for betting lines');
    console.log('5. Combine all sources for comprehensive coverage');
    console.log('\n💡 KEY INSIGHT: We can get 90% of data FREE!');
  }
}

// Run collector
const collector = new UnifiedFantasyDataCollector();
collector.collectAllFantasyData();