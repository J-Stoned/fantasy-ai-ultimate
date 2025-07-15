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
  // Hitting stats
  homeRuns: number;
  rbi: number;
  battingAverage: number;
  runs?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  walks?: number;
  strikeouts?: number;
  stolenBases?: number;
  caughtStealing?: number;
  onBasePercentage?: number;
  sluggingPercentage?: number;
  ops?: number;
  atBats?: number;
  plateAppearances?: number;
  totalBases?: number;
  groundOuts?: number;
  airOuts?: number;
  leftOnBase?: number;
  hitByPitch?: number;
  sacrificeFlies?: number;
  groundIntoDoublePlay?: number;
  // Pitching stats
  era?: number;
  wins?: number;
  pitchingStrikeouts?: number; // Separate from batting strikeouts
  saves?: number;
  losses?: number;
  innings?: number;
  whip?: number;
  pitcherType?: 'starter' | 'reliever' | 'closer';
}

class CurrentMLBStatsCollector {
  
  async collectCurrentStats(): Promise<PlayerStats[]> {
    console.log('🔍 Collecting current MLB statistics...\n');
    
    const allStats: PlayerStats[] = [];
    
    // Collect hitting and pitching stats in parallel
    const [mlbHittingData, mlbPitchingData, espnData] = await Promise.all([
      this.getMLBOfficialStats(),
      this.getMLBPitchingStats(),
      this.getESPNStats()
    ]);
    
    allStats.push(...mlbHittingData);
    allStats.push(...mlbPitchingData);
    allStats.push(...espnData);
    
    console.log(`✅ Collected stats for ${allStats.length} players (hitting + pitching)\n`);
    return allStats;
  }

  async getMLBOfficialStats(): Promise<PlayerStats[]> {
    console.log('⚾ Fetching MLB.com official hitting stats...');
    
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
            runs: parseInt(stats.runs) || 0,
            hits: parseInt(stats.hits) || 0,
            doubles: parseInt(stats.doubles) || 0,
            triples: parseInt(stats.triples) || 0,
            walks: parseInt(stats.baseOnBalls) || 0,
            strikeouts: parseInt(stats.strikeOuts) || 0,
            stolenBases: parseInt(stats.stolenBases) || 0,
            caughtStealing: parseInt(stats.caughtStealing) || 0,
            onBasePercentage: parseFloat(stats.obp) || 0,
            sluggingPercentage: parseFloat(stats.slg) || 0,
            ops: parseFloat(stats.ops) || 0,
            atBats: parseInt(stats.atBats) || 0,
            plateAppearances: parseInt(stats.plateAppearances) || 0,
            totalBases: parseInt(stats.totalBases) || 0,
            groundOuts: parseInt(stats.groundOuts) || 0,
            airOuts: parseInt(stats.airOuts) || 0,
            leftOnBase: parseInt(stats.leftOnBase) || 0,
            hitByPitch: parseInt(stats.hitByPitch) || 0,
            sacrificeFlies: parseInt(stats.sacFlies) || 0,
            groundIntoDoublePlay: parseInt(stats.groundIntoDoublePlay) || 0,
          });
        });
      }
      
      console.log(`   ✅ Found hitting stats for ${players.length} players from MLB.com`);
      return players.slice(0, 100); // Top 100
      
    } catch (error) {
      console.log('   ⚠️ MLB.com hitting stats API failed, continuing...');
      return [];
    }
  }

  async getMLBPitchingStats(): Promise<PlayerStats[]> {
    console.log('🥎 Fetching MLB.com official pitching stats...');
    
    try {
      // MLB Stats API for pitching - free and official
      const response = await axios.get('https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=2025', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const pitchers: PlayerStats[] = [];
      
      if (response.data?.stats?.[0]?.splits) {
        response.data.stats[0].splits.forEach((pitcher: any) => {
          const stats = pitcher.stat;
          const playerInfo = pitcher.player;
          
          // Determine pitcher type based on games started vs relief appearances
          const gamesStarted = parseInt(stats.gamesStarted) || 0;
          const saves = parseInt(stats.saves) || 0;
          let pitcherType: 'starter' | 'reliever' | 'closer' = 'reliever';
          
          if (gamesStarted >= 5) {
            pitcherType = 'starter';
          } else if (saves >= 3) {
            pitcherType = 'closer';
          }
          
          pitchers.push({
            name: playerInfo.fullName,
            team: pitcher.team?.name || 'Unknown',
            position: 'P',
            homeRuns: 0, // Not applicable for pitchers
            rbi: 0, // Not applicable for pitchers
            battingAverage: 0, // Not applicable for pitchers
            era: parseFloat(stats.era) || 0,
            wins: parseInt(stats.wins) || 0,
            losses: parseInt(stats.losses) || 0,
            pitchingStrikeouts: parseInt(stats.strikeOuts) || 0,
            saves: saves,
            innings: parseFloat(stats.inningsPitched) || 0,
            whip: parseFloat(stats.whip) || 0,
            pitcherType: pitcherType
          });
        });
      }
      
      console.log(`   ✅ Found pitching stats for ${pitchers.length} players from MLB.com`);
      return pitchers.slice(0, 150); // More pitchers since we want good coverage
      
    } catch (error) {
      console.log('   ⚠️ MLB.com pitching stats API failed, continuing...');
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
      const statsData: any[] = [];
      
      // Process hitting stats
      players.filter(p => p.position !== 'P' && p.homeRuns >= 0).forEach(player => {
        statsData.push({
          stat_type: 'current_season_hitting',
          stat_value: {
            home_runs: player.homeRuns,
            rbi: player.rbi,
            batting_average: player.battingAverage,
            runs: player.runs || 0,
            hits: player.hits || 0,
            doubles: player.doubles || 0,
            triples: player.triples || 0,
            walks: player.walks || 0,
            strikeouts: player.strikeouts || 0,
            stolen_bases: player.stolenBases || 0,
            caught_stealing: player.caughtStealing || 0,
            on_base_percentage: player.onBasePercentage || 0,
            slugging_percentage: player.sluggingPercentage || 0,
            ops: player.ops || 0,
            at_bats: player.atBats || 0,
            plate_appearances: player.plateAppearances || 0,
            total_bases: player.totalBases || 0,
            ground_outs: player.groundOuts || 0,
            air_outs: player.airOuts || 0,
            left_on_base: player.leftOnBase || 0,
            hit_by_pitch: player.hitByPitch || 0,
            sacrifice_flies: player.sacrificeFlies || 0,
            ground_into_double_play: player.groundIntoDoublePlay || 0,
            player_name: player.name,
            team: player.team,
            position: player.position,
            season: 2025,
            stat_date: new Date().toISOString()
          },
          fantasy_points: player.homeRuns * 4 + player.rbi * 1 // Basic fantasy scoring
        });
      });
      
      // Process pitching stats
      players.filter(p => p.position === 'P' && (p.wins || p.era || p.strikeouts)).forEach(pitcher => {
        statsData.push({
          stat_type: 'current_season_pitching',
          stat_value: {
            wins: pitcher.wins || 0,
            losses: pitcher.losses || 0,
            era: pitcher.era || 0,
            strikeouts: pitcher.pitchingStrikeouts || 0,
            saves: pitcher.saves || 0,
            innings_pitched: pitcher.innings || 0,
            whip: pitcher.whip || 0,
            pitcher_type: pitcher.pitcherType || 'reliever',
            player_name: pitcher.name,
            team: pitcher.team,
            position: pitcher.position,
            season: 2025,
            stat_date: new Date().toISOString()
          },
          fantasy_points: (pitcher.wins || 0) * 6 + (pitcher.saves || 0) * 5 + (pitcher.pitchingStrikeouts || 0) * 1 - (pitcher.era || 0) * 1 // Basic pitching fantasy scoring
        });
      });
      
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
      
      // Save pitching wins leaderboard as news article
      const pitchingWinsLeaders = players
        .filter(p => p.position === 'P' && (p.wins || 0) > 0)
        .sort((a, b) => (b.wins || 0) - (a.wins || 0))
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
          console.log('⚠️ Home run leaderboard article failed:', newsError.message);
        } else {
          console.log('✅ Saved home run leaderboard article to news_articles');
        }
      }
      
      // Save pitching wins leaderboard
      if (pitchingWinsLeaders.length > 0) {
        const winsContent = pitchingWinsLeaders.map((p, i) => 
          `${i + 1}. ${p.name} (${p.team}) - ${p.wins} W, ${p.era?.toFixed(2)} ERA`).join('\n');
        
        const pitchingArticle = {
          title: `MLB Pitching Wins Leaders - ${new Date().toLocaleDateString()}`,
          content: `Current 2025 MLB pitching wins leaders:\n\n${winsContent}\n\nData collected from MLB official statistics.`,
          source: 'MLB Stats API',
          sport_id: 'MLB',
          tags: ['pitching', 'wins', 'leaders', 'statistics', '2025', 'leaderboard'],
          published_at: new Date().toISOString(),
          player_ids: [], // Empty array per schema
          team_ids: []   // Empty array per schema
        };
        
        const { error: pitchingNewsError } = await supabase
          .from('news_articles')
          .insert([pitchingArticle]);
        
        if (pitchingNewsError) {
          console.log('⚠️ Pitching leaderboard article failed:', pitchingNewsError.message);
        } else {
          console.log('✅ Saved pitching wins leaderboard article to news_articles');
        }
      }
      
      // Save to trending_players table for current leaders
      const trendingData: any[] = [];
      
      // Add home run leaders
      if (homeRunLeaders.length > 0) {
        homeRunLeaders.slice(0, 5).forEach(player => {
          trendingData.push({
            player_name: player.name,
            trend_type: 'home_run_leader',
            platform: 'MLB Stats 2025',
            mentions_count: player.homeRuns,
            external_id: `hr_leader_${player.name.replace(/\s+/g, '_')}_${Date.now()}`
          });
        });
      }
      
      // Add pitching wins leaders
      if (pitchingWinsLeaders.length > 0) {
        pitchingWinsLeaders.slice(0, 5).forEach(pitcher => {
          trendingData.push({
            player_name: pitcher.name,
            trend_type: 'pitching_wins_leader',
            platform: 'MLB Stats 2025',
            mentions_count: pitcher.wins || 0,
            external_id: `wins_leader_${pitcher.name.replace(/\s+/g, '_')}_${Date.now()}`
          });
        });
      }
      
      if (trendingData.length > 0) {
        const { error: trendError } = await supabase
          .from('trending_players')
          .insert(trendingData);
        
        if (!trendError) {
          console.log('✅ Saved hitting and pitching leaders to trending_players');
        }
      }
      
      const hittingPlayers = players.filter(p => p.position !== 'P').length;
      const pitchingPlayers = players.filter(p => p.position === 'P').length;
      
      console.log(`\n🎉 Database save complete!`);
      console.log(`👤 Players processed: ${playersInserted}`);
      console.log(`📊 Stats records: ${statsInserted}`);
      console.log(`🏏 Hitting players: ${hittingPlayers}`);
      console.log(`🥎 Pitching players: ${pitchingPlayers}`);
      console.log(`📰 Articles: ${(homeRunLeaders.length > 0 ? 1 : 0) + (pitchingWinsLeaders.length > 0 ? 1 : 0)}`);
      console.log(`📈 Trending records: ${Math.min(homeRunLeaders.length, 5) + Math.min(pitchingWinsLeaders.length, 5)}`);
      
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
    
    // Pitching Wins Leaders
    const pitchingWinsLeaders = players
      .filter(p => p.position === 'P' && (p.wins || 0) > 0)
      .sort((a, b) => (b.wins || 0) - (a.wins || 0))
      .slice(0, 5);
    
    if (pitchingWinsLeaders.length > 0) {
      console.log('\n🥎 PITCHING WINS LEADERS:');
      pitchingWinsLeaders.forEach((pitcher, i) => {
        console.log(`${i + 1}. ${pitcher.name} (${pitcher.team}) - ${pitcher.wins}W, ${pitcher.era?.toFixed(2)} ERA`);
      });
    }
    
    // Runs Leaders
    const runLeaders = players
      .filter(p => p.position !== 'P' && (p.runs || 0) > 0)
      .sort((a, b) => (b.runs || 0) - (a.runs || 0))
      .slice(0, 5);
    
    if (runLeaders.length > 0) {
      console.log('\n🏃 RUNS LEADERS:');
      runLeaders.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name} (${player.team}) - ${player.runs} R`);
      });
    }
    
    // OPS Leaders
    const opsLeaders = players
      .filter(p => p.position !== 'P' && (p.ops || 0) > 0)
      .sort((a, b) => (b.ops || 0) - (a.ops || 0))
      .slice(0, 5);
    
    if (opsLeaders.length > 0) {
      console.log('\n⚡ OPS LEADERS:');
      opsLeaders.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name} (${player.team}) - ${player.ops?.toFixed(3)} OPS`);
      });
    }
    
    // Stolen Base Leaders
    const stolenBaseLeaders = players
      .filter(p => p.position !== 'P' && (p.stolenBases || 0) > 0)
      .sort((a, b) => (b.stolenBases || 0) - (a.stolenBases || 0))
      .slice(0, 5);
    
    if (stolenBaseLeaders.length > 0) {
      console.log('\n🏃‍♂️ STOLEN BASE LEADERS:');
      stolenBaseLeaders.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name} (${player.team}) - ${player.stolenBases} SB`);
      });
    }
    
    // Pitching Strikeout Leaders
    const pitchingStrikeoutLeaders = players
      .filter(p => p.position === 'P' && (p.pitchingStrikeouts || 0) > 0)
      .sort((a, b) => (b.pitchingStrikeouts || 0) - (a.pitchingStrikeouts || 0))
      .slice(0, 5);
    
    if (pitchingStrikeoutLeaders.length > 0) {
      console.log('\n🔥 STRIKEOUT LEADERS:');
      pitchingStrikeoutLeaders.forEach((pitcher, i) => {
        console.log(`${i + 1}. ${pitcher.name} (${pitcher.team}) - ${pitcher.pitchingStrikeouts} K`);
      });
    }
    
    console.log('\n=' .repeat(70));
    const hittingCount = players.filter(p => p.position !== 'P').length;
    const pitchingCount = players.filter(p => p.position === 'P').length;
    
    console.log(`📊 Total players processed: ${players.length}`);
    console.log(`🏏 Hitting players: ${hittingCount}`);
    console.log(`🥎 Pitching players: ${pitchingCount}`);
    console.log(`🏠 Players with HR: ${players.filter(p => p.homeRuns > 0).length}`);
    console.log(`💰 Players with RBI: ${players.filter(p => p.rbi > 0).length}`);
    console.log(`🎯 Pitchers with Wins: ${players.filter(p => (p.wins || 0) > 0).length}`);
    console.log(`🏃 Players with Runs: ${players.filter(p => (p.runs || 0) > 0).length}`);
    console.log(`📊 Players with 20+ Doubles: ${players.filter(p => (p.doubles || 0) >= 20).length}`);
    console.log(`🏃‍♂️ Players with SB: ${players.filter(p => (p.stolenBases || 0) > 0).length}`);
    console.log(`⚡ Players with .800+ OPS: ${players.filter(p => (p.ops || 0) >= 0.800).length}`);
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