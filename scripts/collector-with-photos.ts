#!/usr/bin/env tsx
/**
 * DATA COLLECTOR WITH PLAYER PHOTOS
 * Uses correct photo_url column and populates player headshots
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE'
);

const limit = pLimit(10); // Process 10 concurrent requests

class CollectorWithPhotos {
  private stats = {
    games: 0,
    players: 0,
    gameLogs: 0,
    photosAdded: 0
  };

  async run() {
    console.log('📸 DATA COLLECTOR WITH PLAYER PHOTOS');
    console.log('===================================\n');
    
    const startTime = Date.now();
    
    try {
      // First collect Sleeper players (they have photo URLs!)
      await this.collectSleeperPlayers();
      
      // Then process ESPN games and stats
      await this.processRecentGames();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log('✅ COLLECTION COMPLETE');
      console.log(`⏱️  Time: ${elapsed} seconds`);
      console.log(`📊 Games: ${this.stats.games}`);
      console.log(`👤 Players: ${this.stats.players}`);
      console.log(`📈 Game logs: ${this.stats.gameLogs}`);
      console.log(`📸 Photos added: ${this.stats.photosAdded}`);
      
      await this.checkPhotosCoverage();
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async collectSleeperPlayers() {
    console.log('📥 Collecting Sleeper players with photos...\n');
    
    try {
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = Object.values(response.data);
      
      console.log(`Found ${players.length} NFL players from Sleeper`);
      
      // Process in batches
      const activePlayersWithPhotos = players
        .filter((p: any) => p.status === 'Active' && (p.espn_id || p.fantasy_data_id))
        .slice(0, 500); // Process first 500 active players
      
      console.log(`Processing ${activePlayersWithPhotos.length} active players with potential photos...`);
      
      await Promise.all(
        activePlayersWithPhotos.map((player: any) => 
          limit(() => this.storeSleeperPlayer(player))
        )
      );
      
    } catch (error) {
      console.error('Sleeper error:', error.message);
    }
  }

  async storeSleeperPlayer(sleeperPlayer: any) {
    try {
      // Build photo URL - Sleeper players often have ESPN IDs we can use
      let photoUrl = null;
      
      if (sleeperPlayer.espn_id) {
        // ESPN headshot URL format
        photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${sleeperPlayer.espn_id}.png&w=350&h=254`;
      } else if (sleeperPlayer.yahoo_id) {
        // Yahoo headshot URL format
        photoUrl = `https://s.yimg.com/iu/api/res/1.2/sports/player_${sleeperPlayer.yahoo_id}/image`;
      }
      
      const playerData = {
        external_id: `sleeper_${sleeperPlayer.player_id}`,
        name: sleeperPlayer.full_name,
        firstname: sleeperPlayer.first_name,
        lastname: sleeperPlayer.last_name,
        position: sleeperPlayer.position ? [sleeperPlayer.position] : [],
        team: sleeperPlayer.team,
        jersey_number: sleeperPlayer.number?.toString(),
        heightinches: sleeperPlayer.height ? parseInt(sleeperPlayer.height) / 12 : null,
        weightlbs: sleeperPlayer.weight ? parseInt(sleeperPlayer.weight) : null,
        birthdate: sleeperPlayer.birth_date,
        status: sleeperPlayer.status,
        sport_id: 'nfl',
        photo_url: photoUrl, // Using correct column name!
        metadata: {
          espn_id: sleeperPlayer.espn_id,
          yahoo_id: sleeperPlayer.yahoo_id,
          years_exp: sleeperPlayer.years_exp,
          college: sleeperPlayer.college
        }
      };
      
      const { data: player, error } = await supabase
        .from('players')
        .upsert(playerData, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && player) {
        this.stats.players++;
        if (photoUrl) {
          this.stats.photosAdded++;
          console.log(`  ✅ ${sleeperPlayer.full_name} - Photo added`);
        }
      }
    } catch (error) {
      // Skip individual errors
    }
  }

  async processRecentGames() {
    console.log('\n📊 Processing recent NFL games...\n');
    
    // Get week 18 games
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=18'
    );
    
    const completedGames = response.data.events?.filter((e: any) => 
      e.status.type.completed
    ).slice(0, 5);
    
    console.log(`Processing ${completedGames.length} games from Week 18...`);
    
    for (const game of completedGames) {
      await this.processGame(game);
    }
  }

  async processGame(game: any) {
    try {
      console.log(`\n${game.name}`);
      
      // Store game
      await supabase.from('games').upsert({
        external_id: `espn_${game.id}`,
        sport_id: 'nfl',
        start_time: new Date(game.date),
        status: 'completed'
      }, { onConflict: 'external_id' });
      
      this.stats.games++;
      
      // Get player stats
      const summary = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
      );
      
      if (summary.data.boxscore?.players) {
        for (const teamData of summary.data.boxscore.players) {
          await this.processTeamStats(teamData, game.id);
        }
      }
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }

  async processTeamStats(teamData: any, gameId: string) {
    for (const statCategory of teamData.statistics || []) {
      if (statCategory.athletes?.length > 0) {
        for (const playerData of statCategory.athletes) {
          await this.storePlayerWithStats(
            playerData,
            gameId,
            statCategory.name,
            teamData.team.displayName
          );
        }
      }
    }
  }

  async storePlayerWithStats(playerData: any, gameId: string, category: string, teamName: string) {
    try {
      const athlete = playerData.athlete;
      if (!athlete) return;
      
      // ESPN provides headshot URLs!
      const photoUrl = athlete.headshot?.href || 
        `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athlete.id}.png&w=350&h=254`;
      
      const { data: player } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_${athlete.id}`,
          name: athlete.displayName,
          position: athlete.position ? [athlete.position.abbreviation] : [],
          jersey_number: athlete.jersey,
          team_name: teamName,
          photo_url: photoUrl // Correct column name!
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (player) {
        this.stats.players++;
        if (photoUrl) this.stats.photosAdded++;
        
        // Parse and store stats
        const stats = this.parseStats(playerData.stats, category);
        const fantasyPoints = this.calculateFantasyPoints(stats);
        
        if (fantasyPoints > 0 || this.hasStats(stats)) {
          await supabase.from('player_game_logs').insert({
            player_id: player.id,
            game_id: `espn_${gameId}`,
            game_date: new Date(),
            stats: stats,
            fantasy_points: fantasyPoints
          });
          
          this.stats.gameLogs++;
          console.log(`  📊 ${athlete.displayName}: ${fantasyPoints.toFixed(1)} pts`);
        }
      }
    } catch (error) {
      // Skip errors
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

  async checkPhotosCoverage() {
    console.log('\n📸 PHOTO COVERAGE CHECK:');
    
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { count: playersWithPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .not('photo_url', 'is', null);
    
    const coverage = ((playersWithPhotos || 0) / (totalPlayers || 1) * 100).toFixed(1);
    
    console.log(`Total players: ${totalPlayers}`);
    console.log(`Players with photos: ${playersWithPhotos}`);
    console.log(`Photo coverage: ${coverage}%`);
    
    // Show some examples
    const { data: examples } = await supabase
      .from('players')
      .select('name, photo_url')
      .not('photo_url', 'is', null)
      .limit(3);
    
    if (examples?.length) {
      console.log('\nExample photos:');
      examples.forEach(p => {
        console.log(`- ${p.name}: ${p.photo_url}`);
      });
    }
  }
}

// Run it!
new CollectorWithPhotos().run();