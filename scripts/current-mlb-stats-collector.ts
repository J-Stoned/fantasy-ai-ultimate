#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('📊 CURRENT MLB STATS COLLECTOR');
console.log('⚾ Fetching 2025 season statistics\n');

interface PlayerStats {
  name: string;
  team: string;
  position: string;
  homeRuns: number;
  rbi: number;
  battingAverage: number;
  era?: number;
  wins?: number;
  strikeouts?: number;
  saves?: number;
}

class CurrentMLBStatsCollector {
  
  async collectCurrentStats(): Promise<PlayerStats[]> {
    console.log('🔍 Collecting current MLB statistics...\n');
    
    const allStats: PlayerStats[] = [];
    
    // Try multiple free MLB stats sources
    const mlbStatsData = await this.getMLBOfficialStats();
    const espnStatsData = await this.getESPNStats();
    
    allStats.push(...mlbStatsData);
    allStats.push(...espnStatsData);
    
    console.log(`✅ Collected stats for ${allStats.length} players\n`);
    return allStats;
  }

  async getMLBOfficialStats(): Promise<PlayerStats[]> {
    console.log('⚾ Fetching MLB.com official stats...');
    
    try {
      // MLB Stats API - free and official
      const response = await axios.get('https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting&season=2025', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const players: PlayerStats[] = [];
      
      if (response.data?.stats?.[0]?.splits) {
        response.data.stats[0].splits.forEach((player: any) => {
          const stats = player.stat;
          const playerInfo = player.player;
          
          players.push({
            name: playerInfo.fullName,
            team: player.team?.name || 'Unknown',
            position: playerInfo.primaryPosition?.name || 'Unknown',
            homeRuns: parseInt(stats.homeRuns) || 0,
            rbi: parseInt(stats.rbi) || 0,
            battingAverage: parseFloat(stats.avg) || 0,
          });
        });
      }
      
      console.log(`   ✅ Found stats for ${players.length} players from MLB.com`);
      return players.slice(0, 100); // Top 100
      
    } catch (error) {
      console.log('   ⚠️ MLB.com stats API failed, continuing...');
      return [];
    }
  }

  async getESPNStats(): Promise<PlayerStats[]> {
    console.log('📺 Fetching ESPN stats...');
    
    try {
      // ESPN Fantasy API - free
      const response = await axios.get('https://fantasy.espn.com/apis/v3/games/flb/seasons/2025/segments/0/leaguedefaults/1?view=kona_player_info', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const players: PlayerStats[] = [];
      
      if (response.data?.players) {
        response.data.players.forEach((player: any) => {
          const stats = player.player?.stats?.[0]?.stats;
          if (stats) {
            players.push({
              name: player.player?.fullName || 'Unknown',
              team: player.player?.proTeamId ? this.getTeamName(player.player.proTeamId) : 'Unknown',
              position: this.getPositionName(player.player?.defaultPositionId),
              homeRuns: stats[5] || 0, // HR is typically index 5 in ESPN
              rbi: stats[6] || 0,      // RBI is typically index 6
              battingAverage: stats[0] || 0, // AVG is typically index 0
            });
          }
        });
      }
      
      console.log(`   ✅ Found stats for ${players.length} players from ESPN`);
      return players.slice(0, 100);
      
    } catch (error) {
      console.log('   ⚠️ ESPN stats failed, continuing...');
      return [];
    }
  }

  getTeamName(teamId: number): string {
    const teams: { [key: number]: string } = {
      1: 'Atlanta Braves', 2: 'Miami Marlins', 3: 'New York Mets', 4: 'Philadelphia Phillies',
      5: 'Washington Nationals', 6: 'Chicago Cubs', 7: 'Cincinnati Reds', 8: 'Milwaukee Brewers',
      9: 'Pittsburgh Pirates', 10: 'St. Louis Cardinals', 11: 'Arizona Diamondbacks',
      12: 'Colorado Rockies', 13: 'Los Angeles Dodgers', 14: 'San Diego Padres',
      15: 'San Francisco Giants', 16: 'Baltimore Orioles', 17: 'Boston Red Sox',
      18: 'New York Yankees', 19: 'Tampa Bay Rays', 20: 'Toronto Blue Jays',
      21: 'Chicago White Sox', 22: 'Cleveland Guardians', 23: 'Detroit Tigers',
      24: 'Kansas City Royals', 25: 'Minnesota Twins', 26: 'Houston Astros',
      27: 'Los Angeles Angels', 28: 'Oakland Athletics', 29: 'Seattle Mariners',
      30: 'Texas Rangers'
    };
    return teams[teamId] || 'Unknown';
  }

  getPositionName(positionId: number): string {
    const positions: { [key: number]: string } = {
      1: 'C', 2: '1B', 3: '2B', 4: '3B', 5: 'SS', 6: 'OF', 7: 'DH', 8: 'P'
    };
    return positions[positionId] || 'Unknown';
  }

  async saveToDatabase(players: PlayerStats[]): Promise<void> {
    console.log('💾 Saving current stats to database per schema...\n');
    
    try {
      // First, try to insert/update players table
      const playersData = players.map(player => ({
        name: player.name,
        firstname: player.name.split(' ')[0] || '',
        lastname: player.name.split(' ').slice(1).join(' ') || '',
        position: [player.position], // Array format per schema
        team: player.team,
        sport: 'MLB',
        external_id: `mlb_${player.name.replace(/\s+/g, '_').toLowerCase()}_2025`,
        metadata: {
          home_runs: player.homeRuns,
          rbi: player.rbi,
          batting_average: player.battingAverage,
          season: 2025,
          last_updated: new Date().toISOString()
        }
      }));
      
      console.log('👤 Inserting/updating players...');
      let playersInserted = 0;
      
      // Insert players in small batches to avoid conflicts
      for (const player of playersData.slice(0, 50)) {
        const { data, error } = await supabase
          .from('players')
          .upsert(player, { onConflict: 'external_id' });
        
        if (!error) {
          playersInserted++;
        }
      }
      
      console.log(`✅ Processed ${playersInserted} players`);
      
      // Save detailed stats to player_stats table (matching schema)
      const statsData = players.map(player => ({
        stat_type: 'current_season_hitting',
        stat_value: {
          home_runs: player.homeRuns,
          rbi: player.rbi,
          batting_average: player.battingAverage,
          era: player.era,
          wins: player.wins,
          strikeouts: player.strikeouts,
          saves: player.saves,
          player_name: player.name,
          team: player.team,
          position: player.position,
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: player.homeRuns * 4 + player.rbi * 1 // Basic fantasy scoring
      }));
      
      console.log('📊 Inserting current season stats...');
      const batchSize = 50;
      let statsInserted = 0;
      
      for (let i = 0; i < statsData.length; i += batchSize) {
        const batch = statsData.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('player_stats')
          .insert(batch);
        
        if (error) {
          console.log(`⚠️ Stats batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
        } else {
          statsInserted += batch.length;
          console.log(`✅ Inserted stats batch ${Math.floor(i/batchSize) + 1} (${batch.length} players)`);
        }
      }
      
      // Save home run leaderboard as news article (matching schema)
      const homeRunLeaders = players
        .filter(p => p.homeRuns > 0)
        .sort((a, b) => b.homeRuns - a.homeRuns)
        .slice(0, 10);
      
      if (homeRunLeaders.length > 0) {
        const leaderContent = homeRunLeaders.map((p, i) => 
          `${i + 1}. ${p.name} (${p.team}) - ${p.homeRuns} HR`).join('\n');
        
        const leaderboardArticle = {
          title: `MLB Home Run Leaders - ${new Date().toLocaleDateString()}`,
          content: `Current 2025 MLB home run leaders:\n\n${leaderContent}\n\nData collected from MLB official statistics.`,
          source: 'MLB Stats API',
          sport_id: 'MLB',
          tags: ['home-runs', 'leaders', 'statistics', '2025', 'leaderboard'],
          published_at: new Date().toISOString(),
          player_ids: [], // Empty array per schema
          team_ids: []   // Empty array per schema
        };
        
        const { error: newsError } = await supabase
          .from('news_articles')
          .insert([leaderboardArticle]);
        
        if (newsError) {
          console.log('⚠️ Leaderboard article failed:', newsError.message);
        } else {
          console.log('✅ Saved home run leaderboard article to news_articles');
        }
      }
      
      // Save to trending_players table for current leaders
      if (homeRunLeaders.length > 0) {
        const trendingData = homeRunLeaders.slice(0, 5).map(player => ({
          player_name: player.name,
          trend_type: 'home_run_leader',
          platform: 'MLB Stats 2025',
          mentions_count: player.homeRuns, // Use HR count as mentions
          external_id: `hr_leader_${player.name.replace(/\s+/g, '_')}_${Date.now()}`
        }));
        
        const { error: trendError } = await supabase
          .from('trending_players')
          .insert(trendingData);
        
        if (!trendError) {
          console.log('✅ Saved home run leaders to trending_players');
        }
      }
      
      console.log(`\n🎉 Database save complete!`);
      console.log(`👤 Players processed: ${playersInserted}`);
      console.log(`📊 Stats records: ${statsInserted}`);
      console.log(`📰 Articles: ${homeRunLeaders.length > 0 ? 1 : 0}`);
      console.log(`📈 Trending records: ${Math.min(homeRunLeaders.length, 5)}`);
      
    } catch (error) {
      console.error('❌ Database save error:', error);
    }
  }

  displayResults(players: PlayerStats[]): void {
    console.log('🏆 CURRENT MLB STATISTICS\n');
    console.log('=' .repeat(70));
    
    // Home Run Leaders
    const homeRunLeaders = players
      .filter(p => p.homeRuns > 0)
      .sort((a, b) => b.homeRuns - a.homeRuns)
      .slice(0, 10);
    
    if (homeRunLeaders.length > 0) {
      console.log('\n🎯 HOME RUN LEADERS:');
      homeRunLeaders.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name} (${player.team}) - ${player.homeRuns} HR`);
      });
    }
    
    // RBI Leaders
    const rbiLeaders = players
      .filter(p => p.rbi > 0)
      .sort((a, b) => b.rbi - a.rbi)
      .slice(0, 5);
    
    if (rbiLeaders.length > 0) {
      console.log('\n💪 RBI LEADERS:');
      rbiLeaders.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name} (${player.team}) - ${player.rbi} RBI`);
      });
    }
    
    // Batting Average Leaders
    const avgLeaders = players
      .filter(p => p.battingAverage > 0)
      .sort((a, b) => b.battingAverage - a.battingAverage)
      .slice(0, 5);
    
    if (avgLeaders.length > 0) {
      console.log('\n🎯 BATTING AVERAGE LEADERS:');
      avgLeaders.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name} (${player.team}) - ${player.battingAverage.toFixed(3)}`);
      });
    }
    
    console.log('\n=' .repeat(70));
    console.log(`📊 Total players processed: ${players.length}`);
    console.log(`🏠 Players with HR: ${players.filter(p => p.homeRuns > 0).length}`);
    console.log(`💰 Players with RBI: ${players.filter(p => p.rbi > 0).length}`);
  }
}

// Main execution
async function main() {
  const collector = new CurrentMLBStatsCollector();
  
  try {
    const players = await collector.collectCurrentStats();
    
    if (players.length > 0) {
      collector.displayResults(players);
      await collector.saveToDatabase(players);
    } else {
      console.log('❌ No current stats collected. APIs may be unavailable or season may not have started.');
      console.log('💡 Note: 2025 season may not have official stats yet.');
    }
    
  } catch (error) {
    console.error('❌ Stats collection failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { CurrentMLBStatsCollector };