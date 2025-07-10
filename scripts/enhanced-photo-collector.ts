#!/usr/bin/env tsx
/**
 * ENHANCED PHOTO COLLECTOR
 * Focus on getting photos for existing players without them
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = pLimit(20);

class EnhancedPhotoCollector {
  private stats = {
    photosAdded: 0,
    playersUpdated: 0,
    errors: 0
  };

  async run() {
    console.log('📸 ENHANCED PHOTO COLLECTOR');
    console.log('===========================\n');
    
    const startTime = Date.now();
    
    try {
      // 1. Fix NBA players (high priority - 0% coverage)
      await this.fixNBAPhotos();
      
      // 2. Get more NFL photos
      await this.enhanceNFLPhotos();
      
      // 3. Fix unknown sport players
      await this.fixUnknownSportPlayers();
      
      // Summary
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log('✅ COLLECTION COMPLETE');
      console.log(`⏱️  Time: ${elapsed} seconds`);
      console.log(`📸 Photos added: ${this.stats.photosAdded}`);
      console.log(`👤 Players updated: ${this.stats.playersUpdated}`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      
    } catch (error) {
      console.error('Fatal error:', error);
    }
  }

  async fixNBAPhotos() {
    console.log('🏀 Fixing NBA player photos...\n');
    
    try {
      // Get all NBA players without photos
      const { data: nbaPlayers } = await supabase
        .from('players')
        .select('id, name, external_id')
        .eq('sport_id', 'nba')
        .is('photo_url', null)
        .limit(500);
      
      if (!nbaPlayers?.length) {
        console.log('No NBA players without photos');
        return;
      }
      
      console.log(`Found ${nbaPlayers.length} NBA players without photos`);
      
      // Try different approaches to get photos
      for (const player of nbaPlayers) {
        await this.findNBAPhoto(player);
      }
      
    } catch (error) {
      console.error('NBA error:', error.message);
    }
  }

  async findNBAPhoto(player: any) {
    try {
      // Extract ESPN ID from external_id if possible
      let espnId = null;
      
      if (player.external_id?.includes('espn_')) {
        espnId = player.external_id.replace('espn_nba_', '').replace('espn_', '');
      }
      
      // Try different photo URL patterns
      const photoUrls = [];
      
      if (espnId) {
        photoUrls.push(
          `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=350&h=254`,
          `https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png`
        );
      }
      
      // Try name-based search
      const nameParts = player.name.toLowerCase().split(' ');
      if (nameParts.length >= 2) {
        // Try common patterns
        photoUrls.push(
          `https://cdn.nba.com/headshots/nba/latest/1040x760/${nameParts.join('')}.png`,
          `https://cdn.nba.com/headshots/nba/latest/260x190/${nameParts.join('')}.png`
        );
      }
      
      // Test URLs and use first working one
      for (const url of photoUrls) {
        try {
          const response = await axios.head(url, { timeout: 2000 });
          if (response.status === 200) {
            const { error } = await supabase
              .from('players')
              .update({ photo_url: url })
              .eq('id', player.id);
            
            if (!error) {
              this.stats.photosAdded++;
              this.stats.playersUpdated++;
              console.log(`✅ ${player.name}`);
              return;
            }
          }
        } catch {
          // Try next URL
        }
      }
    } catch (error) {
      this.stats.errors++;
    }
  }

  async enhanceNFLPhotos() {
    console.log('\n🏈 Enhancing NFL player photos...\n');
    
    try {
      // Get more players from Sleeper with all available IDs
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = Object.values(response.data);
      
      // Get players we don't have photos for yet
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('external_id')
        .eq('sport_id', 'nfl')
        .not('photo_url', 'is', null);
      
      const existingIds = new Set(existingPlayers?.map(p => p.external_id));
      
      // Filter to players we haven't processed
      const newPlayers = players
        .filter((p: any) => 
          p.espn_id && 
          !existingIds.has(`sleeper_${p.player_id}`) &&
          (p.status === 'Active' || p.status === 'Inactive' || p.years_exp > 0)
        )
        .slice(0, 3000); // Get up to 3000 more
      
      console.log(`Processing ${newPlayers.length} new NFL players...`);
      
      const chunks = this.chunkArray(newPlayers, 100);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(player => limit(() => this.storeNFLPlayer(player)))
        );
        console.log(`  Processed ${chunk.length} players...`);
      }
      
    } catch (error) {
      console.error('NFL error:', error.message);
    }
  }

  async storeNFLPlayer(player: any) {
    try {
      // Multiple photo URL options
      const photoUrls = [];
      
      if (player.espn_id) {
        photoUrls.push(
          `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id}.png&w=350&h=254`,
          `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`
        );
      }
      
      if (player.yahoo_id) {
        photoUrls.push(
          `https://s.yimg.com/iu/api/res/1.2/CGDwPjEBj6RgI5P8HAqE6A--~C/YXBwaWQ9eXNwb3J0cztjaD0yMzM2O2NyPTE7Y3c9MTc5MDtkeD04NTc7ZHk9MDtmaT11bGNyb3A7aD02MDtxPTEwMDt3PTQ2/https://s.yimg.com/xe/i/us/sp/v/nfl_cutout/players_l/${player.yahoo_id}.png`
        );
      }
      
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
        photo_url: photoUrls[0], // Use ESPN as primary
        college: player.college || null,
        metadata: {
          espn_id: player.espn_id,
          yahoo_id: player.yahoo_id,
          years_exp: player.years_exp,
          draft_year: player.draft_year,
          draft_round: player.draft_round,
          draft_pick: player.draft_pick,
          photo_urls: photoUrls // Store all options
        }
      };
      
      const { data, error } = await supabase
        .from('players')
        .upsert(playerData, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.playersUpdated++;
        this.stats.photosAdded++;
      }
    } catch (error) {
      this.stats.errors++;
    }
  }

  async fixUnknownSportPlayers() {
    console.log('\n🔧 Fixing unknown sport players...\n');
    
    try {
      // Get players with null sport_id
      const { data: unknownPlayers } = await supabase
        .from('players')
        .select('id, name, external_id, sport')
        .is('sport_id', null)
        .limit(1000);
      
      if (!unknownPlayers?.length) {
        console.log('No unknown sport players found');
        return;
      }
      
      console.log(`Found ${unknownPlayers.length} players with unknown sport`);
      
      for (const player of unknownPlayers) {
        // Try to determine sport from external_id or sport field
        let sportId = null;
        let photoUrl = null;
        
        if (player.external_id?.includes('nfl') || player.sport === 'football') {
          sportId = 'nfl';
          const espnId = player.external_id?.match(/\d+/)?.[0];
          if (espnId) {
            photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=350&h=254`;
          }
        } else if (player.external_id?.includes('nba') || player.sport === 'basketball') {
          sportId = 'nba';
          const espnId = player.external_id?.match(/\d+/)?.[0];
          if (espnId) {
            photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=350&h=254`;
          }
        } else if (player.external_id?.includes('mlb') || player.sport === 'baseball') {
          sportId = 'mlb';
          const espnId = player.external_id?.match(/\d+/)?.[0];
          if (espnId) {
            photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/${espnId}.png&w=350&h=254`;
          }
        } else if (player.external_id?.includes('nhl') || player.sport === 'hockey') {
          sportId = 'nhl';
          const espnId = player.external_id?.match(/\d+/)?.[0];
          if (espnId) {
            photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nhl/players/full/${espnId}.png&w=350&h=254`;
          }
        }
        
        if (sportId) {
          const updates: any = { sport_id: sportId };
          if (photoUrl) {
            updates.photo_url = photoUrl;
            this.stats.photosAdded++;
          }
          
          const { error } = await supabase
            .from('players')
            .update(updates)
            .eq('id', player.id);
          
          if (!error) {
            this.stats.playersUpdated++;
          }
        }
      }
      
    } catch (error) {
      console.error('Unknown sport error:', error.message);
    }
  }

  chunkArray(array: any[], size: number): any[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Run it!
new EnhancedPhotoCollector().run();