#!/usr/bin/env tsx
/**
 * 🎯 PLAYER MATCHER
 * Smart player matching across different data sources
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class PlayerMatcher {
  private cache = new Map<string, number>();
  
  /**
   * Find player by name and sport
   */
  async findPlayer(name: string, sport: string): Promise<number | null> {
    // Check cache first
    const cacheKey = `${name}_${sport}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Parse name
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    // Try exact match first
    const { data: exactMatch } = await supabase
      .from('players')
      .select('id')
      .eq('firstname', firstName)
      .eq('lastname', lastName)
      .eq('sport_id', sport)
      .limit(1);
      
    if (exactMatch && exactMatch.length > 0) {
      this.cache.set(cacheKey, exactMatch[0].id);
      return exactMatch[0].id;
    }
    
    // Try case-insensitive match
    const { data: caseMatch } = await supabase
      .from('players')
      .select('id')
      .ilike('firstname', firstName)
      .ilike('lastname', lastName)
      .eq('sport_id', sport)
      .limit(1);
      
    if (caseMatch && caseMatch.length > 0) {
      this.cache.set(cacheKey, caseMatch[0].id);
      return caseMatch[0].id;
    }
    
    // Try last name only (for players like "Smith Jr.")
    if (lastName) {
      const { data: lastNameMatch } = await supabase
        .from('players')
        .select('id, firstname')
        .ilike('lastname', `%${lastName}%`)
        .eq('sport_id', sport)
        .limit(5);
        
      if (lastNameMatch && lastNameMatch.length > 0) {
        // Check if first name is similar
        const match = lastNameMatch.find(p => 
          p.firstname.toLowerCase().startsWith(firstName.toLowerCase()) ||
          firstName.toLowerCase().startsWith(p.firstname.toLowerCase())
        );
        
        if (match) {
          this.cache.set(cacheKey, match.id);
          return match.id;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Create or find player
   */
  async ensurePlayer(playerData: {
    name: string;
    sport: string;
    espnId: string;
    team?: string;
  }): Promise<number> {
    // Try to find existing player
    const existingId = await this.findPlayer(playerData.name, playerData.sport);
    if (existingId) {
      return existingId;
    }
    
    // Create new player
    const nameParts = playerData.name.split(' ');
    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert({
        firstname: nameParts[0],
        lastname: nameParts.slice(1).join(' ') || 'Unknown',
        sport_id: playerData.sport,
        external_id: `espn_${playerData.espnId}`,
        status: 'active'
      })
      .select('id')
      .single();
      
    if (error) {
      throw new Error(`Failed to create player ${playerData.name}: ${error.message}`);
    }
    
    if (newPlayer) {
      this.cache.set(`${playerData.name}_${playerData.sport}`, newPlayer.id);
      return newPlayer.id;
    }
    
    throw new Error(`Failed to create player ${playerData.name}`);
  }
  
  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).slice(0, 10)
    };
  }
}

export const playerMatcher = new PlayerMatcher();