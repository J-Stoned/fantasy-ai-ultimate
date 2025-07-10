#!/usr/bin/env tsx
/**
 * FIXED PRODUCTION COLLECTOR - All column names corrected!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = pLimit(10);

class FixedProductionCollector {
  private stats = {
    games: 0,
    players: 0,
    gameLogs: 0,
    photosAdded: 0,
    errors: 0
  };

  async run() {
    console.log('🚀 FIXED PRODUCTION COLLECTOR');
    console.log('============================\n');
    
    const startTime = Date.now();
    
    try {
      // 1. Collect Sleeper players with photos
      await this.collectSleeperPlayers();
      
      // 2. Collect ESPN games and stats
      await this.collectESPNData();
      
      // 3. Collect NBA data
      await this.collectNBAData();
      
      // Summary
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log('✅ COLLECTION COMPLETE');
      console.log(`⏱️  Time: ${elapsed} seconds`);
      console.log(`📊 Games: ${this.stats.games}`);
      console.log(`👤 Players: ${this.stats.players}`);
      console.log(`📈 Game logs: ${this.stats.gameLogs}`);
      console.log(`📸 Photos: ${this.stats.photosAdded}`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      
      await this.checkProgress();
      
    } catch (error) {
      console.error('Fatal error:', error);
    }
  }

  async collectSleeperPlayers() {
    console.log('📥 Collecting Sleeper NFL players...\n');
    
    try {
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = Object.values(response.data);
      
      // Get active players with ESPN IDs for photos
      const activePlayers = players
        .filter((p: any) => p.status === 'Active' && p.espn_id)
        .slice(0, 1000); // Process first 1000
      
      console.log(`Processing ${activePlayers.length} active players...`);
      
      const chunks = this.chunkArray(activePlayers, 100);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(player => limit(() => this.storeSleeperPlayer(player)))
        );
        console.log(`  Processed ${chunk.length} players...`);
      }
      
    } catch (error) {
      console.error('Sleeper error:', error.message);
      this.stats.errors++;
    }
  }

  async storeSleeperPlayer(player: any) {
    try {
      const photoUrl = player.espn_id 
        ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id}.png&w=350&h=254`
        : null;
      
      const playerData = {
        external_id: `sleeper_${player.player_id}`,
        name: player.full_name,
        firstname: player.first_name,
        lastname: player.last_name,
        position: player.position ? [player.position] : [],
        jersey_number: player.number ? parseInt(player.number) : null,
        team: player.team || null,
        team_abbreviation: player.team || null,
        heightinches: player.height ? parseInt(player.height) : null,
        weightlbs: player.weight ? parseInt(player.weight) : null,
        birthdate: player.birth_date || null,
        status: player.status,
        sport_id: 'nfl',
        sport: 'football',
        photo_url: photoUrl,
        college: player.college || null,
        metadata: {
          espn_id: player.espn_id,
          yahoo_id: player.yahoo_id,
          years_exp: player.years_exp
        }
      };
      
      const { data, error } = await supabase
        .from('players')
        .upsert(playerData, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.players++;
        if (photoUrl) this.stats.photosAdded++;
      }
    } catch (error) {
      // Skip individual errors
    }
  }

  async collectESPNData() {
    console.log('\n📊 Collecting ESPN NFL data...\n');
    
    // Process recent weeks
    const weeks = [15, 16, 17, 18];
    
    for (const week of weeks) {
      console.log(`Week ${week}:`);
      
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=${week}`
        );
        
        const completedGames = response.data.events?.filter((e: any) => 
          e.status.type.completed
        ) || [];
        
        console.log(`  ${completedGames.length} completed games`);
        
        // Process first 5 games per week
        for (const game of completedGames.slice(0, 5)) {
          await this.processESPNGame(game);
        }
        
      } catch (error) {
        console.error(`  Week ${week} error:`, error.message);
        this.stats.errors++;
      }
    }
  }

  async processESPNGame(game: any) {
    try {
      // Store game
      await supabase.from('games').upsert({
        external_id: `espn_${game.id}`,
        sport_id: 'nfl',
        start_time: new Date(game.date),
        status: 'completed'
      }, { onConflict: 'external_id' });
      
      this.stats.games++;
      
      // Get box score
      const summary = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
      );
      
      if (summary.data.boxscore?.players) {
        for (const teamData of summary.data.boxscore.players) {
          await this.processTeamStats(teamData, game.id);
        }
      }
      
    } catch (error) {
      this.stats.errors++;
    }
  }

  async processTeamStats(teamData: any, gameId: string) {
    const teamName = teamData.team.displayName;
    const teamAbbr = teamData.team.abbreviation;
    
    for (const statCategory of teamData.statistics || []) {
      if (statCategory.athletes?.length > 0) {
        // Process top performers
        for (const playerData of statCategory.athletes.slice(0, 5)) {
          await this.storePlayerWithStats(
            playerData, 
            gameId, 
            statCategory.name,
            teamName,
            teamAbbr
          );
        }
      }
    }
  }

  async storePlayerWithStats(playerData: any, gameId: string, category: string, teamName: string, teamAbbr: string) {
    try {
      const athlete = playerData.athlete;
      if (!athlete) return;
      
      // ESPN player with photo
      const photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athlete.id}.png&w=350&h=254`;
      
      const { data: player, error } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_${athlete.id}`,
          name: athlete.displayName,
          position: athlete.position ? [athlete.position.abbreviation] : [],
          jersey_number: athlete.jersey ? parseInt(athlete.jersey) : null,
          team: teamName,
          team_abbreviation: teamAbbr,
          sport_id: 'nfl',
          sport: 'football',
          photo_url: photoUrl
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (error) {
        console.error('Player error:', error.message);
        return;
      }
      
      if (player) {
        this.stats.players++;
        this.stats.photosAdded++;
        
        // Parse stats
        const stats = this.parseStats(playerData.stats, category);
        const fantasyPoints = this.calculateFantasyPoints(stats);
        
        if (fantasyPoints > 0 || this.hasStats(stats)) {
          const { error: logError } = await supabase
            .from('player_game_logs')
            .insert({
              player_id: player.id,
              game_id: `espn_${gameId}`,
              game_date: new Date(),
              stats: stats,
              fantasy_points: fantasyPoints
            });
          
          if (!logError) {
            this.stats.gameLogs++;
            console.log(`    ✅ ${athlete.displayName}: ${fantasyPoints.toFixed(1)} pts`);
          } else {
            console.error('Game log error:', logError.message);
          }
        }
      }
    } catch (error) {
      this.stats.errors++;
    }
  }

  async collectNBAData() {
    console.log('\n🏀 Collecting NBA data...\n');
    
    try {
      // Get recent NBA games from ESPN
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
      );
      
      const completedGames = response.data.events?.filter((e: any) => 
        e.status.type.completed
      ).slice(0, 3);
      
      console.log(`Found ${completedGames?.length || 0} completed NBA games`);
      
      for (const game of completedGames || []) {
        await this.processNBAGame(game);
      }
      
    } catch (error) {
      console.error('NBA error:', error.message);
      this.stats.errors++;
    }
  }

  async processNBAGame(game: any) {
    try {
      // Store game
      await supabase.from('games').upsert({
        external_id: `espn_nba_${game.id}`,
        sport_id: 'nba',
        start_time: new Date(game.date),
        status: 'completed'
      }, { onConflict: 'external_id' });
      
      this.stats.games++;
      
      // Get box score
      const summary = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.id}`
      );
      
      if (summary.data.boxscore?.players) {
        for (const teamData of summary.data.boxscore.players) {
          // Process top scorers
          const scoringCategory = teamData.statistics?.find((s: any) => s.name === 'scoring');
          if (scoringCategory?.athletes) {
            for (const player of scoringCategory.athletes.slice(0, 3)) {
              await this.storeNBAPlayer(player, game.id, teamData.team);
            }
          }
        }
      }
    } catch (error) {
      this.stats.errors++;
    }
  }

  async storeNBAPlayer(playerData: any, gameId: string, team: any) {
    try {
      const athlete = playerData.athlete;
      const photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${athlete.id}.png&w=350&h=254`;
      
      const { data: player } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_nba_${athlete.id}`,
          name: athlete.displayName,
          position: athlete.position ? [athlete.position.abbreviation] : [],
          jersey_number: athlete.jersey ? parseInt(athlete.jersey) : null,
          team: team.displayName,
          team_abbreviation: team.abbreviation,
          sport_id: 'nba',
          sport: 'basketball',
          photo_url: photoUrl
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (player) {
        this.stats.players++;
        this.stats.photosAdded++;
        
        // Simple NBA stats
        const stats = {
          points: parseInt(playerData.stats[0]) || 0,
          rebounds: parseInt(playerData.stats[1]) || 0,
          assists: parseInt(playerData.stats[2]) || 0
        };
        
        const fantasyPoints = stats.points + stats.rebounds * 1.2 + stats.assists * 1.5;
        
        await supabase.from('player_game_logs').insert({
          player_id: player.id,
          game_id: `espn_nba_${gameId}`,
          game_date: new Date(),
          stats: stats,
          fantasy_points: fantasyPoints
        });
        
        this.stats.gameLogs++;
      }
    } catch (error) {
      // Skip
    }
  }

  parseStats(statsArray: string[], category: string): any {
    const stats: any = { category };
    
    if (!statsArray) return stats;
    
    switch (category) {
      case 'passing':
        const [compAtt, yds, , td, int] = statsArray;
        if (compAtt?.includes('/')) {
          const [comp, att] = compAtt.split('/').map(Number);
          stats.completions = comp || 0;
          stats.attempts = att || 0;
        }
        stats.passing_yards = parseInt(yds) || 0;
        stats.passing_tds = parseInt(td) || 0;
        stats.interceptions = parseInt(int) || 0;
        break;
        
      case 'rushing':
        stats.carries = parseInt(statsArray[0]) || 0;
        stats.rushing_yards = parseInt(statsArray[1]) || 0;
        stats.rushing_tds = parseInt(statsArray[3]) || 0;
        break;
        
      case 'receiving':
        stats.receptions = parseInt(statsArray[0]) || 0;
        stats.receiving_yards = parseInt(statsArray[1]) || 0;
        stats.receiving_tds = parseInt(statsArray[3]) || 0;
        stats.targets = parseInt(statsArray[5]) || 0;
        break;
    }
    
    return stats;
  }

  hasStats(stats: any): boolean {
    return Object.values(stats).some(val => 
      typeof val === 'number' && val > 0
    );
  }

  calculateFantasyPoints(stats: any): number {
    return (
      (stats.passing_yards || 0) * 0.04 +
      (stats.passing_tds || 0) * 4 +
      (stats.interceptions || 0) * -2 +
      (stats.rushing_yards || 0) * 0.1 +
      (stats.rushing_tds || 0) * 6 +
      (stats.receptions || 0) * 1 +
      (stats.receiving_yards || 0) * 0.1 +
      (stats.receiving_tds || 0) * 6
    );
  }

  chunkArray(array: any[], size: number): any[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async checkProgress() {
    console.log('\n📊 DATABASE STATUS:');
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: playersWithPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .not('photo_url', 'is', null);
    
    console.log(`Total games: ${totalGames}`);
    console.log(`Total players: ${totalPlayers}`);
    console.log(`Total game logs: ${totalLogs}`);
    console.log(`Players with photos: ${playersWithPhotos}`);
    
    const coverage = ((totalLogs || 0) / ((totalGames || 1) * 20) * 100).toFixed(2);
    console.log(`\nEstimated coverage: ${coverage}%`);
  }
}

// Run it!
new FixedProductionCollector().run();