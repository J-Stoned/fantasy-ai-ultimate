#!/usr/bin/env tsx
/**
 * ALL SPORTS PHOTO COLLECTOR
 * Comprehensive photo collection for NFL, NBA, MLB, NHL, and NCAA
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = pLimit(20);

class AllSportsPhotoCollector {
  private stats = {
    nfl: 0,
    nba: 0,
    mlb: 0,
    nhl: 0,
    ncaa: 0,
    total: 0,
    errors: 0
  };

  async run() {
    console.log('🏆 ALL SPORTS PHOTO COLLECTOR');
    console.log('==============================\n');
    
    const startTime = Date.now();
    
    try {
      // 1. NFL - Get remaining players
      console.log('Phase 1: NFL Players');
      await this.collectNFLPhotos();
      
      // 2. NBA - Fix all players without photos
      console.log('\nPhase 2: NBA Players');
      await this.collectNBAPhotos();
      
      // 3. MLB - Get all teams and players
      console.log('\nPhase 3: MLB Players');
      await this.collectMLBPhotos();
      
      // 4. NHL - Get all teams and players
      console.log('\nPhase 4: NHL Players');
      await this.collectNHLPhotos();
      
      // 5. NCAA - College football and basketball
      console.log('\nPhase 5: NCAA Players');
      await this.collectNCAAPhotos();
      
      // Summary
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log('✅ COLLECTION COMPLETE');
      console.log(`⏱️  Time: ${elapsed} seconds`);
      console.log(`\n📸 PHOTOS ADDED:`);
      console.log(`🏈 NFL: ${this.stats.nfl.toLocaleString()}`);
      console.log(`🏀 NBA: ${this.stats.nba.toLocaleString()}`);
      console.log(`⚾ MLB: ${this.stats.mlb.toLocaleString()}`);
      console.log(`🏒 NHL: ${this.stats.nhl.toLocaleString()}`);
      console.log(`🎓 NCAA: ${this.stats.ncaa.toLocaleString()}`);
      console.log(`\n📊 TOTAL: ${this.stats.total.toLocaleString()}`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      
      await this.showFinalCoverage();
      
    } catch (error) {
      console.error('Fatal error:', error);
    }
  }

  async collectNFLPhotos() {
    console.log('🏈 Collecting NFL photos...');
    
    try {
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = Object.values(response.data);
      
      // Get ALL players with ESPN IDs
      const playersToProcess = players
        .filter((p: any) => p.espn_id)
        .slice(0, 5000);
      
      console.log(`Processing ${playersToProcess.length} NFL players...`);
      
      const chunks = this.chunkArray(playersToProcess, 200);
      
      for (let i = 0; i < chunks.length; i++) {
        await Promise.all(
          chunks[i].map(player => limit(() => this.storePlayer(player, 'nfl')))
        );
        
        if (i % 5 === 0) {
          console.log(`  Progress: ${(i + 1) * 200}/${playersToProcess.length}`);
        }
      }
      
    } catch (error) {
      console.error('NFL error:', error.message);
      this.stats.errors++;
    }
  }

  async collectNBAPhotos() {
    console.log('🏀 Collecting NBA photos...');
    
    try {
      // All NBA teams
      const teams = [
        'atl', 'bos', 'bkn', 'cha', 'chi', 'cle', 'dal', 'den', 'det', 'gsw',
        'hou', 'ind', 'lac', 'lal', 'mem', 'mia', 'mil', 'min', 'no', 'ny',
        'okc', 'orl', 'phi', 'phx', 'por', 'sac', 'sa', 'tor', 'utah', 'wsh'
      ];
      
      console.log(`Processing ${teams.length} NBA teams...`);
      
      for (const team of teams) {
        await this.processNBATeam(team);
      }
      
    } catch (error) {
      console.error('NBA error:', error.message);
      this.stats.errors++;
    }
  }

  async processNBATeam(teamAbbr: string) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamAbbr}/roster`
      );
      
      const athletes = response.data.athletes || [];
      
      for (const group of athletes) {
        for (const player of group.items || []) {
          await this.storePlayer(player, 'nba', response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamAbbr.toUpperCase()}`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async collectMLBPhotos() {
    console.log('⚾ Collecting MLB photos...');
    
    try {
      // All MLB teams
      const teams = [
        'ari', 'atl', 'bal', 'bos', 'chc', 'chw', 'cin', 'cle', 'col', 'det',
        'hou', 'kc', 'laa', 'lad', 'mia', 'mil', 'min', 'nym', 'nyy', 'oak',
        'phi', 'pit', 'sd', 'sf', 'sea', 'stl', 'tb', 'tex', 'tor', 'wsh'
      ];
      
      console.log(`Processing ${teams.length} MLB teams...`);
      
      for (const team of teams) {
        await this.processMLBTeam(team);
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
      }
      
    } catch (error) {
      console.error('MLB error:', error.message);
      this.stats.errors++;
    }
  }

  async processMLBTeam(teamAbbr: string) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamAbbr}/roster`
      );
      
      const athletes = response.data.athletes || [];
      
      for (const group of athletes) {
        for (const player of group.items || []) {
          await this.storePlayer(player, 'mlb', response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamAbbr.toUpperCase()}`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async collectNHLPhotos() {
    console.log('🏒 Collecting NHL photos...');
    
    try {
      // All NHL teams
      const teams = [
        'ana', 'ari', 'bos', 'buf', 'car', 'cbj', 'cgy', 'chi', 'col', 'dal',
        'det', 'edm', 'fla', 'la', 'min', 'mtl', 'nj', 'nsh', 'nyi', 'nyr',
        'ott', 'phi', 'pit', 'sj', 'sea', 'stl', 'tb', 'tor', 'van', 'vgk',
        'wsh', 'wpg'
      ];
      
      console.log(`Processing ${teams.length} NHL teams...`);
      
      for (const team of teams) {
        await this.processNHLTeam(team);
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
      }
      
    } catch (error) {
      console.error('NHL error:', error.message);
      this.stats.errors++;
    }
  }

  async processNHLTeam(teamAbbr: string) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${teamAbbr}/roster`
      );
      
      const athletes = response.data.athletes || [];
      
      for (const group of athletes) {
        for (const player of group.items || []) {
          await this.storePlayer(player, 'nhl', response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamAbbr.toUpperCase()}`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async collectNCAAPhotos() {
    console.log('🎓 Collecting NCAA photos...');
    
    try {
      // Top college football teams
      const cfbTeams = [
        { id: '57', name: 'Georgia' },
        { id: '333', name: 'Alabama' },
        { id: '2390', name: 'Michigan' },
        { id: '2294', name: 'Florida State' },
        { id: '228', name: 'Ohio State' },
        { id: '61', name: 'Clemson' },
        { id: '87', name: 'Notre Dame' },
        { id: '251', name: 'Texas' },
        { id: '99', name: 'LSU' },
        { id: '12', name: 'USC' }
      ];
      
      console.log('\n📏 College Football:');
      for (const team of cfbTeams) {
        await this.processNCAATeam(team.id, team.name, 'football');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Top college basketball teams
      const cbbTeams = [
        { id: '150', name: 'Duke' },
        { id: '153', name: 'North Carolina' },
        { id: '96', name: 'Kentucky' },
        { id: '2305', name: 'Kansas' },
        { id: '222', name: 'Villanova' },
        { id: '2250', name: 'Gonzaga' },
        { id: '26', name: 'UCLA' },
        { id: '84', name: 'Indiana' }
      ];
      
      console.log('\n🏀 College Basketball:');
      for (const team of cbbTeams) {
        await this.processNCAATeam(team.id, team.name, 'basketball');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error('NCAA error:', error.message);
      this.stats.errors++;
    }
  }

  async processNCAATeam(teamId: string, teamName: string, sport: string) {
    try {
      const sportPath = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/${sport}/${sportPath}/teams/${teamId}/roster`
      );
      
      const athletes = response.data.athletes || [];
      
      for (const group of athletes) {
        for (const player of group.items || []) {
          await this.storeNCAAPlayer(player, sport, response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamName}`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async storePlayer(playerData: any, sport: string, team?: any) {
    try {
      let photoUrl = '';
      let externalId = '';
      let playerInfo: any = {};
      
      if (sport === 'nfl' && playerData.espn_id) {
        // Sleeper data
        externalId = `sleeper_${playerData.player_id}`;
        photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${playerData.espn_id}.png&w=350&h=254`;
        
        playerInfo = {
          external_id: externalId,
          name: playerData.full_name,
          firstname: playerData.first_name,
          lastname: playerData.last_name,
          position: playerData.position ? [playerData.position] : [],
          jersey_number: playerData.number ? parseInt(playerData.number) : null,
          team: playerData.team || null,
          team_abbreviation: playerData.team || null,
          sport_id: 'nfl',
          sport: 'football',
          photo_url: photoUrl,
          metadata: {
            espn_id: playerData.espn_id,
            years_exp: playerData.years_exp
          }
        };
      } else {
        // ESPN data
        externalId = `espn_${sport}_${playerData.id}`;
        photoUrl = playerData.headshot?.href || 
          `https://a.espncdn.com/combiner/i?img=/i/headshots/${sport}/players/full/${playerData.id}.png&w=350&h=254`;
        
        playerInfo = {
          external_id: externalId,
          name: playerData.displayName,
          firstname: playerData.firstName || playerData.displayName.split(' ')[0],
          lastname: playerData.lastName || playerData.displayName.split(' ').slice(1).join(' '),
          position: playerData.position ? [playerData.position.abbreviation || playerData.position.displayName] : [],
          jersey_number: playerData.jersey ? parseInt(playerData.jersey) : null,
          team: team?.displayName || null,
          team_abbreviation: team?.abbreviation || null,
          sport_id: sport,
          sport: this.getSportName(sport),
          photo_url: photoUrl,
          heightinches: this.parseHeight(playerData.displayHeight),
          weightlbs: playerData.displayWeight ? parseInt(playerData.displayWeight) : null,
          metadata: {
            espn_id: playerData.id
          }
        };
      }
      
      const { data, error } = await supabase
        .from('players')
        .upsert(playerInfo, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats[sport]++;
        this.stats.total++;
      }
    } catch (error) {
      this.stats.errors++;
    }
  }

  async storeNCAAPlayer(playerData: any, sport: string, team: any) {
    try {
      const sportPrefix = sport === 'football' ? 'college-football' : 'mens-college-basketball';
      const photoUrl = playerData.headshot?.href || 
        `https://a.espncdn.com/combiner/i?img=/i/headshots/${sportPrefix}/players/full/${playerData.id}.png&w=350&h=254`;
      
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
        photo_url: photoUrl,
        heightinches: this.parseHeight(playerData.displayHeight),
        weightlbs: playerData.displayWeight ? parseInt(playerData.displayWeight) : null,
        college: team.displayName,
        metadata: {
          espn_id: playerData.id,
          class: playerData.experience?.displayValue
        }
      };
      
      const { data, error } = await supabase
        .from('players')
        .upsert(playerInfo, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.ncaa++;
        this.stats.total++;
      }
    } catch (error) {
      this.stats.errors++;
    }
  }

  getSportName(sportId: string): string {
    const sportMap: any = {
      nfl: 'football',
      nba: 'basketball',
      mlb: 'baseball',
      nhl: 'hockey',
      ncaa_football: 'football',
      ncaa_basketball: 'basketball'
    };
    return sportMap[sportId] || sportId;
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

  async showFinalCoverage() {
    console.log('\n📊 FINAL PHOTO COVERAGE:');
    
    const sports = [
      { id: 'nfl', name: 'NFL' },
      { id: 'nba', name: 'NBA' },
      { id: 'mlb', name: 'MLB' },
      { id: 'nhl', name: 'NHL' },
      { id: 'ncaa_football', name: 'NCAA FB' },
      { id: 'ncaa_basketball', name: 'NCAA BB' }
    ];
    
    for (const sport of sports) {
      const { count: total } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport.id);
      
      const { count: withPhotos } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport.id)
        .not('photo_url', 'is', null);
      
      const coverage = total ? ((withPhotos || 0) / total * 100).toFixed(1) : '0';
      console.log(`${sport.name}: ${withPhotos?.toLocaleString() || 0}/${total?.toLocaleString() || 0} (${coverage}%)`);
    }
  }
}

// Run it!
new AllSportsPhotoCollector().run();