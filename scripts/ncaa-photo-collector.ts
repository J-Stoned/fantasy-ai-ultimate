#!/usr/bin/env tsx
/**
 * NCAA PHOTO COLLECTOR
 * Comprehensive collection for college football and basketball
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = pLimit(10);

class NCAAPhotoCollector {
  private stats = {
    footballPlayers: 0,
    basketballPlayers: 0,
    totalPhotos: 0,
    errors: 0
  };

  async run() {
    console.log('🎓 NCAA PHOTO COLLECTOR');
    console.log('=======================\n');
    
    const startTime = Date.now();
    
    try {
      // 1. College Football - Top 25 teams + more
      await this.collectCollegeFootball();
      
      // 2. College Basketball - Top programs
      await this.collectCollegeBasketball();
      
      // Summary
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log('✅ NCAA COLLECTION COMPLETE');
      console.log(`⏱️  Time: ${elapsed} seconds`);
      console.log(`\n📸 PHOTOS ADDED:`);
      console.log(`🏈 College Football: ${this.stats.footballPlayers.toLocaleString()}`);
      console.log(`🏀 College Basketball: ${this.stats.basketballPlayers.toLocaleString()}`);
      console.log(`📊 Total Photos: ${this.stats.totalPhotos.toLocaleString()}`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      
      await this.showNCAAProgress();
      
    } catch (error) {
      console.error('Fatal error:', error);
    }
  }

  async collectCollegeFootball() {
    console.log('🏈 COLLEGE FOOTBALL COLLECTION');
    console.log('==============================\n');
    
    // Extended list of top college football programs
    const teams = [
      // SEC
      { id: '57', name: 'Georgia', conf: 'SEC' },
      { id: '333', name: 'Alabama', conf: 'SEC' },
      { id: '99', name: 'LSU', conf: 'SEC' },
      { id: '245', name: 'Texas A&M', conf: 'SEC' },
      { id: '235', name: 'Tennessee', conf: 'SEC' },
      { id: '2579', name: 'South Carolina', conf: 'SEC' },
      { id: '61', name: 'Florida', conf: 'SEC' },
      { id: '2', name: 'Auburn', conf: 'SEC' },
      { id: '344', name: 'Mississippi State', conf: 'SEC' },
      { id: '145', name: 'Ole Miss', conf: 'SEC' },
      { id: '238', name: 'Kentucky', conf: 'SEC' },
      { id: '8', name: 'Arkansas', conf: 'SEC' },
      { id: '258', name: 'Vanderbilt', conf: 'SEC' },
      { id: '2390', name: 'Missouri', conf: 'SEC' },
      
      // Big Ten
      { id: '130', name: 'Michigan', conf: 'Big Ten' },
      { id: '194', name: 'Ohio State', conf: 'Big Ten' },
      { id: '356', name: 'Penn State', conf: 'Big Ten' },
      { id: '275', name: 'Wisconsin', conf: 'Big Ten' },
      { id: '84', name: 'Indiana', conf: 'Big Ten' },
      { id: '135', name: 'Minnesota', conf: 'Big Ten' },
      { id: '2294', name: 'Iowa', conf: 'Big Ten' },
      { id: '77', name: 'Nebraska', conf: 'Big Ten' },
      { id: '127', name: 'Michigan State', conf: 'Big Ten' },
      { id: '213', name: 'Purdue', conf: 'Big Ten' },
      { id: '164', name: 'Northwestern', conf: 'Big Ten' },
      { id: '2287', name: 'Illinois', conf: 'Big Ten' },
      { id: '120', name: 'Maryland', conf: 'Big Ten' },
      { id: '183', name: 'Rutgers', conf: 'Big Ten' },
      
      // ACC
      { id: '228', name: 'Clemson', conf: 'ACC' },
      { id: '52', name: 'Florida State', conf: 'ACC' },
      { id: '154', name: 'Miami', conf: 'ACC' },
      { id: '152', name: 'North Carolina', conf: 'ACC' },
      { id: '150', name: 'Duke', conf: 'ACC' },
      { id: '259', name: 'Virginia Tech', conf: 'ACC' },
      { id: '151', name: 'NC State', conf: 'ACC' },
      { id: '59', name: 'Georgia Tech', conf: 'ACC' },
      { id: '103', name: 'Louisville', conf: 'ACC' },
      { id: '221', name: 'Pittsburgh', conf: 'ACC' },
      { id: '264', name: 'Wake Forest', conf: 'ACC' },
      { id: '258', name: 'Virginia', conf: 'ACC' },
      { id: '193', name: 'Syracuse', conf: 'ACC' },
      { id: '228', name: 'Boston College', conf: 'ACC' },
      
      // Big 12
      { id: '251', name: 'Texas', conf: 'Big 12' },
      { id: '201', name: 'Oklahoma', conf: 'Big 12' },
      { id: '197', name: 'Oklahoma State', conf: 'Big 12' },
      { id: '239', name: 'Baylor', conf: 'Big 12' },
      { id: '2628', name: 'TCU', conf: 'Big 12' },
      { id: '66', name: 'Iowa State', conf: 'Big 12' },
      { id: '2305', name: 'Kansas', conf: 'Big 12' },
      { id: '2306', name: 'Kansas State', conf: 'Big 12' },
      { id: '277', name: 'West Virginia', conf: 'Big 12' },
      { id: '248', name: 'Texas Tech', conf: 'Big 12' },
      
      // Pac-12
      { id: '12', name: 'USC', conf: 'Pac-12' },
      { id: '26', name: 'UCLA', conf: 'Pac-12' },
      { id: '204', name: 'Oregon', conf: 'Pac-12' },
      { id: '264', name: 'Washington', conf: 'Pac-12' },
      { id: '9', name: 'Arizona State', conf: 'Pac-12' },
      { id: '254', name: 'Utah', conf: 'Pac-12' },
      { id: '36', name: 'Colorado', conf: 'Pac-12' },
      { id: '24', name: 'Stanford', conf: 'Pac-12' },
      { id: '25', name: 'Cal', conf: 'Pac-12' },
      { id: '2711', name: 'Oregon State', conf: 'Pac-12' },
      { id: '265', name: 'Washington State', conf: 'Pac-12' },
      { id: '12', name: 'Arizona', conf: 'Pac-12' },
      
      // Independents & Others
      { id: '87', name: 'Notre Dame', conf: 'Independent' },
      { id: '252', name: 'BYU', conf: 'Independent' },
      { id: '349', name: 'Army', conf: 'Independent' },
      { id: '2426', name: 'Navy', conf: 'AAC' },
      { id: '2116', name: 'Cincinnati', conf: 'AAC' },
      { id: '2638', name: 'UCF', conf: 'AAC' },
      { id: '151', name: 'Memphis', conf: 'AAC' },
      { id: '62', name: 'Boise State', conf: 'Mountain West' },
      { id: '278', name: 'Air Force', conf: 'Mountain West' }
    ];
    
    console.log(`Processing ${teams.length} college football teams...\n`);
    
    // Process in batches
    const batches = this.chunkArray(teams, 10);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Batch ${i + 1}/${batches.length}:`);
      
      await Promise.all(
        batches[i].map(team => 
          limit(async () => {
            await this.processCollegeTeam(team, 'football');
            console.log(`  ✓ ${team.name}`);
          })
        )
      );
      
      // Rate limit between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async collectCollegeBasketball() {
    console.log('\n🏀 COLLEGE BASKETBALL COLLECTION');
    console.log('=================================\n');
    
    // Top college basketball programs
    const teams = [
      // Blue Bloods
      { id: '150', name: 'Duke', conf: 'ACC' },
      { id: '96', name: 'Kentucky', conf: 'SEC' },
      { id: '153', name: 'North Carolina', conf: 'ACC' },
      { id: '2305', name: 'Kansas', conf: 'Big 12' },
      { id: '26', name: 'UCLA', conf: 'Pac-12' },
      { id: '84', name: 'Indiana', conf: 'Big Ten' },
      
      // Recent Champions & Top Programs
      { id: '222', name: 'Villanova', conf: 'Big East' },
      { id: '97', name: 'Louisville', conf: 'ACC' },
      { id: '2250', name: 'Gonzaga', conf: 'WCC' },
      { id: '251', name: 'Texas', conf: 'Big 12' },
      { id: '130', name: 'Michigan', conf: 'Big Ten' },
      { id: '127', name: 'Michigan State', conf: 'Big Ten' },
      { id: '259', name: 'Virginia', conf: 'ACC' },
      { id: '2', name: 'Auburn', conf: 'SEC' },
      { id: '239', name: 'Baylor', conf: 'Big 12' },
      
      // Big East Powers
      { id: '41', name: 'UConn', conf: 'Big East' },
      { id: '46', name: 'Creighton', conf: 'Big East' },
      { id: '269', name: 'Xavier', conf: 'Big East' },
      { id: '87', name: 'Marquette', conf: 'Big East' },
      { id: '2603', name: 'Seton Hall', conf: 'Big East' },
      { id: '156', name: 'Providence', conf: 'Big East' },
      { id: '58', name: 'Georgetown', conf: 'Big East' },
      { id: '2635', name: 'St. Johns', conf: 'Big East' },
      { id: '2507', name: 'Butler', conf: 'Big East' },
      
      // SEC Powers
      { id: '2633', name: 'Tennessee', conf: 'SEC' },
      { id: '8', name: 'Arkansas', conf: 'SEC' },
      { id: '61', name: 'Florida', conf: 'SEC' },
      { id: '99', name: 'LSU', conf: 'SEC' },
      { id: '333', name: 'Alabama', conf: 'SEC' },
      
      // ACC Powers
      { id: '234', name: 'Syracuse', conf: 'ACC' },
      { id: '52', name: 'Florida State', conf: 'ACC' },
      { id: '228', name: 'Clemson', conf: 'ACC' },
      { id: '151', name: 'NC State', conf: 'ACC' },
      { id: '154', name: 'Miami', conf: 'ACC' },
      
      // Big Ten Powers
      { id: '2509', name: 'Purdue', conf: 'Big Ten' },
      { id: '356', name: 'Ohio State', conf: 'Big Ten' },
      { id: '275', name: 'Wisconsin', conf: 'Big Ten' },
      { id: '356', name: 'Penn State', conf: 'Big Ten' },
      { id: '2287', name: 'Illinois', conf: 'Big Ten' },
      { id: '120', name: 'Maryland', conf: 'Big Ten' },
      { id: '135', name: 'Minnesota', conf: 'Big Ten' },
      { id: '2294', name: 'Iowa', conf: 'Big Ten' },
      
      // West Coast
      { id: '12', name: 'Arizona', conf: 'Pac-12' },
      { id: '204', name: 'Oregon', conf: 'Pac-12' },
      { id: '21', name: 'San Diego State', conf: 'Mountain West' },
      { id: '2571', name: "Saint Mary's", conf: 'WCC' },
      
      // Mid-Majors
      { id: '139', name: 'Memphis', conf: 'AAC' },
      { id: '248', name: 'Houston', conf: 'AAC' },
      { id: '2116', name: 'Cincinnati', conf: 'AAC' },
      { id: '2670', name: 'VCU', conf: 'A-10' },
      { id: '2168', name: 'Dayton', conf: 'A-10' }
    ];
    
    console.log(`Processing ${teams.length} college basketball teams...\n`);
    
    // Process in batches
    const batches = this.chunkArray(teams, 8);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Batch ${i + 1}/${batches.length}:`);
      
      await Promise.all(
        batches[i].map(team => 
          limit(async () => {
            await this.processCollegeTeam(team, 'basketball');
            console.log(`  ✓ ${team.name}`);
          })
        )
      );
      
      // Rate limit between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async processCollegeTeam(team: any, sport: string) {
    try {
      const sportPath = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/${sport}/${sportPath}/teams/${team.id}/roster`,
        { timeout: 5000 }
      );
      
      const athletes = response.data.athletes || [];
      let teamPhotos = 0;
      
      for (const group of athletes) {
        for (const player of group.items || []) {
          const stored = await this.storeNCAAPlayer(player, sport, response.data.team, team.conf);
          if (stored) teamPhotos++;
        }
      }
      
      if (sport === 'football') {
        this.stats.footballPlayers += teamPhotos;
      } else {
        this.stats.basketballPlayers += teamPhotos;
      }
      this.stats.totalPhotos += teamPhotos;
      
    } catch (error) {
      this.stats.errors++;
    }
  }

  async storeNCAAPlayer(playerData: any, sport: string, team: any, conference: string) {
    try {
      const sportPrefix = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      
      // Multiple photo URL options
      const photoUrls = [];
      
      if (playerData.headshot?.href) {
        photoUrls.push(playerData.headshot.href);
      }
      
      // ESPN patterns
      photoUrls.push(
        `https://a.espncdn.com/combiner/i?img=/i/headshots/${sportPrefix}/players/full/${playerData.id}.png&w=350&h=254`,
        `https://a.espncdn.com/i/headshots/${sportPrefix}/players/full/${playerData.id}.png`
      );
      
      const playerInfo = {
        external_id: `espn_ncaa_${sport}_${playerData.id}`,
        name: playerData.displayName,
        firstname: playerData.firstName || playerData.displayName.split(' ')[0],
        lastname: playerData.lastName || playerData.displayName.split(' ').slice(1).join(' '),
        position: playerData.position ? [playerData.position.abbreviation || playerData.position.displayName] : [],
        jersey_number: playerData.jersey ? parseInt(playerData.jersey) : null,
        team: team.displayName,
        team_abbreviation: team.abbreviation,
        sport_id: `ncaa_${sport}`,
        sport: sport,
        photo_url: photoUrls[0],
        heightinches: this.parseHeight(playerData.displayHeight),
        weightlbs: playerData.displayWeight ? parseInt(playerData.displayWeight) : null,
        college: team.displayName,
        metadata: {
          espn_id: playerData.id,
          class: playerData.experience?.displayValue,
          hometown: playerData.birthPlace?.city,
          homestate: playerData.birthPlace?.state,
          conference: conference,
          alternate_photos: photoUrls
        }
      };
      
      const { data, error } = await supabase
        .from('players')
        .upsert(playerInfo, { onConflict: 'external_id' })
        .select()
        .single();
      
      return !error && data;
    } catch (error) {
      return false;
    }
  }

  parseHeight(heightStr: string): number | null {
    if (!heightStr) return null;
    const match = heightStr.match(/(\d+)'?\s*(\d+)?/);
    if (match) {
      const feet = parseInt(match[1]) || 0;
      const inches = parseInt(match[2]) || 0;
      return feet * 12 + inches;
    }
    return null;
  }

  chunkArray(array: any[], size: number): any[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async showNCAAProgress() {
    console.log('\n📊 NCAA PHOTO COVERAGE:');
    
    const { count: footballTotal } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'ncaa_football');
    
    const { count: footballWithPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'ncaa_football')
      .not('photo_url', 'is', null);
    
    const { count: basketballTotal } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'ncaa_basketball');
    
    const { count: basketballWithPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'ncaa_basketball')
      .not('photo_url', 'is', null);
    
    const fbCoverage = footballTotal ? ((footballWithPhotos || 0) / footballTotal * 100).toFixed(1) : '0';
    const bbCoverage = basketballTotal ? ((basketballWithPhotos || 0) / basketballTotal * 100).toFixed(1) : '0';
    
    console.log(`College Football: ${footballWithPhotos?.toLocaleString() || 0}/${footballTotal?.toLocaleString() || 0} (${fbCoverage}%)`);
    console.log(`College Basketball: ${basketballWithPhotos?.toLocaleString() || 0}/${basketballTotal?.toLocaleString() || 0} (${bbCoverage}%)`);
    
    // Sample recent additions
    console.log('\n🎓 RECENT NCAA ADDITIONS:');
    const { data: recentPlayers } = await supabase
      .from('players')
      .select('name, team, sport_id, metadata')
      .or('sport_id.eq.ncaa_football,sport_id.eq.ncaa_basketball')
      .order('created_at', { ascending: false })
      .limit(5);
    
    recentPlayers?.forEach(p => {
      const sport = p.sport_id === 'ncaa_football' ? '🏈' : '🏀';
      const conf = p.metadata?.conference || 'Unknown';
      console.log(`${sport} ${p.name} - ${p.team} (${conf})`);
    });
  }
}

// Run it!
new NCAAPhotoCollector().run();