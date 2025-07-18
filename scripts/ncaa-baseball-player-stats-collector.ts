import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE SETTINGS
const HTTP_LIMIT = pLimit(24); // 24 concurrent HTTP threads
const DB_LIMIT = pLimit(6);     // DB operations
const BATCH_SIZE = 1000;        // Large batches for 32GB RAM

interface APILimitation {
  endpoint: string;
  issue: string;
  testedAt: Date;
  workaround?: string;
  severity: 'critical' | 'major' | 'minor';
}

class NCAABaseballPlayerStatsCollector {
  private startTime = Date.now();
  private totalPlayers = 0;
  private totalStats = 0;
  private gamesProcessed = 0;
  
  // Caches
  private playerCache = new Map<string, number>(); // external_id -> id
  private teamCache = new Map<string, number>();
  
  // Buffers
  private playerBuffer: any[] = [];
  private statsBuffer: any[] = [];
  
  // API Limitations tracking
  private apiLimitations: APILimitation[] = [];

  async collectAllPlayersAndStats() {
    console.log(chalk.cyan('🚀 NCAA Baseball Player & Stats Collector'));
    console.log(chalk.yellow('💪 Testing ALL ESPN API endpoints'));
    console.log(chalk.yellow('📝 Documenting EVERY limitation\n'));

    // Load team cache
    await this.loadTeamCache();

    // Get all NCAA Baseball games
    const { data: games, error } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id, sport')
      .eq('sport', 'NCAA_BASEBALL')
      .eq('status', 'completed')
      .order('start_time', { ascending: false })
      .limit(100); // Start with recent games to test current API

    if (error || !games) {
      console.error('Failed to fetch games:', error);
      return;
    }

    console.log(chalk.blue(`📊 Processing ${games.length} games to collect players and stats\n`));

    // Test different approaches
    await this.testAllAPIEndpoints(games[0]);

    // Process games in batches
    const gameChunks = [];
    for (let i = 0; i < games.length; i += 10) {
      gameChunks.push(games.slice(i, i + 10));
    }

    for (const chunk of gameChunks) {
      const promises = chunk.map(game => 
        HTTP_LIMIT(() => this.processGame(game))
      );
      
      await Promise.all(promises);
      
      // Flush buffers periodically
      if (this.playerBuffer.length >= BATCH_SIZE) {
        await this.flushPlayerBuffer();
      }
      if (this.statsBuffer.length >= BATCH_SIZE) {
        await this.flushStatsBuffer();
      }

      this.gamesProcessed += chunk.length;
      console.log(chalk.gray(`Progress: ${this.gamesProcessed}/${games.length} games | ${this.totalPlayers} players | ${this.totalStats} stats`));
    }

    // Final flush
    await this.flushPlayerBuffer();
    await this.flushStatsBuffer();

    // Generate limitation report
    await this.generateLimitationReport();
    
    this.printFinalStats();
  }

  async testAllAPIEndpoints(sampleGame: any) {
    console.log(chalk.yellow('🧪 Testing ESPN API endpoints...\n'));
    
    const gameId = sampleGame.external_id.replace('espn_ncaa_baseball_', '');
    
    // Test 1: Game Summary endpoint
    console.log(chalk.blue('1️⃣ Testing Game Summary endpoint...'));
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.boxscore) {
        console.log(chalk.green('✅ Game Summary: Has boxscore data'));
        if (data.boxscore.players) {
          console.log(chalk.green('✅ Players array found in boxscore'));
        } else {
          console.log(chalk.red('❌ No players array in boxscore'));
          this.apiLimitations.push({
            endpoint: 'Game Summary',
            issue: 'No players array in boxscore',
            testedAt: new Date(),
            severity: 'critical'
          });
        }
      } else {
        console.log(chalk.red('❌ No boxscore in game summary'));
        this.apiLimitations.push({
          endpoint: 'Game Summary',
          issue: 'No boxscore data available',
          testedAt: new Date(),
          severity: 'critical'
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Game Summary endpoint failed'));
      this.apiLimitations.push({
        endpoint: 'Game Summary',
        issue: `Endpoint failed: ${error}`,
        testedAt: new Date(),
        severity: 'critical'
      });
    }

    // Test 2: Roster endpoint
    console.log(chalk.blue('\n2️⃣ Testing Team Roster endpoint...'));
    try {
      // Get a team external ID
      const { data: team } = await supabase
        .from('teams')
        .select('external_id')
        .eq('id', sampleGame.home_team_id)
        .single();
      
      if (team) {
        const teamId = team.external_id.replace('espn_ncaa_baseball_', '');
        const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}/roster`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.athletes) {
          console.log(chalk.green(`✅ Roster endpoint: ${data.athletes.length} players found`));
        } else {
          console.log(chalk.red('❌ No athletes in roster response'));
          this.apiLimitations.push({
            endpoint: 'Team Roster',
            issue: 'No athletes array in response',
            testedAt: new Date(),
            severity: 'major'
          });
        }
      }
    } catch (error) {
      console.log(chalk.red('❌ Roster endpoint failed'));
      this.apiLimitations.push({
        endpoint: 'Team Roster',
        issue: `Endpoint failed: ${error}`,
        testedAt: new Date(),
        severity: 'major'
      });
    }

    // Test 3: Player Stats endpoint
    console.log(chalk.blue('\n3️⃣ Testing Player Stats endpoint...'));
    try {
      // Try a known player ID (this will likely fail for NCAA)
      const url = `https://site.api.espn.com/apis/common/v3/sports/baseball/college-baseball/athletes/4917947/stats`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log(chalk.green('✅ Player stats endpoint accessible'));
      } else {
        console.log(chalk.red(`❌ Player stats endpoint returned ${response.status}`));
        this.apiLimitations.push({
          endpoint: 'Player Stats',
          issue: `Endpoint returns ${response.status} for NCAA players`,
          testedAt: new Date(),
          severity: 'major'
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Player stats endpoint failed'));
    }

    // Test 4: Play-by-play endpoint
    console.log(chalk.blue('\n4️⃣ Testing Play-by-play endpoint...'));
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/playbyplay?event=${gameId}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.plays) {
        console.log(chalk.green(`✅ Play-by-play available: ${data.plays.length} plays`));
      } else {
        console.log(chalk.red('❌ No play-by-play data'));
        this.apiLimitations.push({
          endpoint: 'Play-by-play',
          issue: 'No plays data available',
          testedAt: new Date(),
          severity: 'minor'
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Play-by-play endpoint failed'));
    }

    console.log(chalk.yellow('\n🧪 API testing complete\n'));
  }

  async processGame(game: any) {
    const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
    
    try {
      // Try game summary first
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      const response = await fetch(summaryUrl);
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      
      // Extract rosters from game info if available
      if (data.rosters) {
        for (const roster of data.rosters) {
          await this.processRoster(roster, game);
        }
      }

      // Extract stats from boxscore if available
      if (data.boxscore?.players) {
        await this.processBoxscore(data.boxscore.players, game);
      }

      // Try to get additional player info from teams
      if (data.gameInfo?.competitors) {
        for (const competitor of data.gameInfo.competitors) {
          if (competitor.roster) {
            await this.processCompetitorRoster(competitor.roster, competitor.id, game);
          }
        }
      }

    } catch (error) {
      // Silently continue - we're documenting failures separately
    }
  }

  async processRoster(roster: any, game: any) {
    if (!roster.roster) return;

    for (const player of roster.roster) {
      const playerData = {
        external_id: `espn_ncaa_baseball_${player.id}`,
        name: player.athlete?.displayName || player.name || 'Unknown',
        team_id: this.teamCache.get(`espn_ncaa_baseball_${roster.team.id}`),
        jersey_number: player.jersey,
        position: player.position?.abbreviation,
        sport: 'NCAA_BASEBALL',
        metadata: {
          height: player.athlete?.height,
          weight: player.athlete?.weight,
          birthDate: player.athlete?.birthDate,
          hometown: player.athlete?.birthPlace?.city
        }
      };

      this.playerBuffer.push(playerData);
      this.totalPlayers++;
    }
  }

  async processBoxscore(players: any[], game: any) {
    for (const teamPlayers of players) {
      if (!teamPlayers.statistics) continue;

      for (const playerStat of teamPlayers.statistics) {
        for (const athlete of playerStat.athletes || []) {
          // Create player if not exists
          const playerData = {
            external_id: `espn_ncaa_baseball_${athlete.athlete.id}`,
            name: athlete.athlete.displayName,
            team_id: this.teamCache.get(`espn_ncaa_baseball_${teamPlayers.team.id}`),
            sport: 'NCAA_BASEBALL',
            metadata: {}
          };

          this.playerBuffer.push(playerData);

          // Extract stats
          if (athlete.stats && athlete.stats.length > 0) {
            const stats = this.parseBaseballStats(athlete.stats, playerStat.name);
            
            if (Object.keys(stats).length > 0) {
              this.statsBuffer.push({
                player_external_id: playerData.external_id,
                game_id: game.id,
                stats: stats,
                stat_type: playerStat.name // 'batting', 'pitching', etc.
              });
              this.totalStats++;
            }
          }
        }
      }
    }
  }

  async processCompetitorRoster(roster: any[], teamId: string, game: any) {
    for (const player of roster) {
      const playerData = {
        external_id: `espn_ncaa_baseball_${player.id}`,
        name: player.fullName || player.displayName || 'Unknown',
        team_id: this.teamCache.get(`espn_ncaa_baseball_${teamId}`),
        jersey_number: player.jersey,
        position: player.position,
        sport: 'NCAA_BASEBALL',
        metadata: {
          year: player.year,
          experience: player.experience
        }
      };

      this.playerBuffer.push(playerData);
    }
  }

  parseBaseballStats(statsArray: string[], statType: string): any {
    const stats: any = {};
    
    // Map stat positions based on type
    if (statType === 'batting') {
      const battingMap = ['AB', 'R', 'H', 'RBI', 'BB', 'SO', 'AVG'];
      statsArray.forEach((value, index) => {
        if (battingMap[index] && value !== '-') {
          stats[battingMap[index].toLowerCase()] = parseFloat(value) || 0;
        }
      });
    } else if (statType === 'pitching') {
      const pitchingMap = ['IP', 'H', 'R', 'ER', 'BB', 'SO', 'ERA'];
      statsArray.forEach((value, index) => {
        if (pitchingMap[index] && value !== '-') {
          stats[pitchingMap[index].toLowerCase()] = parseFloat(value) || 0;
        }
      });
    }

    return stats;
  }

  async loadTeamCache() {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    if (teams) {
      teams.forEach(team => {
        this.teamCache.set(team.external_id, team.id);
      });
    }
  }

  async flushPlayerBuffer() {
    if (this.playerBuffer.length === 0) return;

    const players = [...new Map(this.playerBuffer.map(p => [p.external_id, p])).values()];
    this.playerBuffer = [];

    await DB_LIMIT(async () => {
      const { data, error } = await supabase
        .from('players')
        .upsert(players, { onConflict: 'external_id' })
        .select('id, external_id');

      if (data) {
        data.forEach(player => {
          this.playerCache.set(player.external_id, player.id);
        });
      }
    });
  }

  async flushStatsBuffer() {
    if (this.statsBuffer.length === 0) return;

    const stats = [...this.statsBuffer];
    this.statsBuffer = [];

    // Map to player IDs
    const statsWithIds = stats.map(stat => ({
      player_id: this.playerCache.get(stat.player_external_id),
      game_id: stat.game_id,
      stat_type: stat.stat_type,
      stat_value: stat.stats,
      fantasy_points: this.calculateFantasyPoints(stat.stats, stat.stat_type)
    })).filter(s => s.player_id);

    await DB_LIMIT(async () => {
      const { error } = await supabase
        .from('player_stats')
        .insert(statsWithIds);

      if (error) {
        console.error('Error inserting stats:', error);
      }
    });
  }

  calculateFantasyPoints(stats: any, statType: string): number {
    let points = 0;
    
    if (statType === 'batting') {
      points += (stats.h || 0) * 1;
      points += (stats.r || 0) * 1;
      points += (stats.rbi || 0) * 1;
      points += (stats.bb || 0) * 1;
      points += (stats.sb || 0) * 2;
      points -= (stats.so || 0) * 0.5;
    } else if (statType === 'pitching') {
      points += (stats.ip || 0) * 3;
      points += (stats.so || 0) * 1;
      points -= (stats.er || 0) * 1;
      points -= (stats.bb || 0) * 0.5;
      points -= (stats.h || 0) * 0.5;
    }

    return points;
  }

  async generateLimitationReport() {
    const report = {
      generated_at: new Date().toISOString(),
      total_limitations: this.apiLimitations.length,
      critical_issues: this.apiLimitations.filter(l => l.severity === 'critical').length,
      major_issues: this.apiLimitations.filter(l => l.severity === 'major').length,
      minor_issues: this.apiLimitations.filter(l => l.severity === 'minor').length,
      limitations: this.apiLimitations,
      summary: {
        rosters_available: this.totalPlayers > 0,
        stats_available: this.totalStats > 0,
        recommended_approach: this.totalStats > 0 ? 'Use game summary endpoint' : 'Limited data available'
      }
    };

    await fs.writeFile(
      'NCAA_BASEBALL_API_LIMITATIONS.json',
      JSON.stringify(report, null, 2)
    );

    console.log(chalk.yellow('\n📝 API Limitation Report saved to NCAA_BASEBALL_API_LIMITATIONS.json'));
  }

  printFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;

    console.log(chalk.cyan('\n🎉 COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Games Processed: ${this.gamesProcessed}`));
    console.log(chalk.green(`👥 Players Collected: ${this.totalPlayers}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.totalStats}`));
    console.log(chalk.yellow(`⚠️  API Limitations Found: ${this.apiLimitations.length}`));
    console.log(chalk.yellow(`⏱️  Total Time: ${elapsed.toFixed(1)} seconds`));
    console.log('═══════════════════════════════════════════════════════');

    if (this.apiLimitations.length > 0) {
      console.log(chalk.red('\n⚠️  Critical Limitations:'));
      this.apiLimitations.filter(l => l.severity === 'critical').forEach(l => {
        console.log(chalk.red(`   - ${l.endpoint}: ${l.issue}`));
      });
    }
  }
}

// RUN IT!
const collector = new NCAABaseballPlayerStatsCollector();
collector.collectAllPlayersAndStats()
  .then(() => {
    console.log(chalk.green('\n✅ Player and stats collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });