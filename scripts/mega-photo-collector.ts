#!/usr/bin/env tsx
/**
 * MEGA PHOTO COLLECTOR - Get photos for ALL sports players
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = pLimit(20); // More concurrent requests for photos

class MegaPhotoCollector {
  private stats = {
    nflPhotos: 0,
    nbaPhotos: 0,
    mlbPhotos: 0,
    nhlPhotos: 0,
    soccerPhotos: 0,
    totalPhotos: 0,
    playersUpdated: 0,
    errors: 0
  };

  async run() {
    console.log('📸 MEGA PHOTO COLLECTOR - ALL SPORTS');
    console.log('====================================\n');
    
    const startTime = Date.now();
    
    try {
      // 1. Collect NFL photos (from Sleeper + ESPN)
      await this.collectNFLPhotos();
      
      // 2. Collect NBA photos (from ESPN)
      await this.collectNBAPhotos();
      
      // 3. Collect MLB photos (from ESPN)
      await this.collectMLBPhotos();
      
      // 4. Collect NHL photos (from ESPN)
      await this.collectNHLPhotos();
      
      // 5. Collect Soccer photos (from ESPN)
      await this.collectSoccerPhotos();
      
      // 6. Update existing players without photos
      await this.updateExistingPlayersPhotos();
      
      // Summary
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log('✅ PHOTO COLLECTION COMPLETE');
      console.log(`⏱️  Time: ${elapsed} seconds`);
      console.log(`\n📸 PHOTOS ADDED BY SPORT:`);
      console.log(`🏈 NFL: ${this.stats.nflPhotos}`);
      console.log(`🏀 NBA: ${this.stats.nbaPhotos}`);
      console.log(`⚾ MLB: ${this.stats.mlbPhotos}`);
      console.log(`🏒 NHL: ${this.stats.nhlPhotos}`);
      console.log(`⚽ Soccer: ${this.stats.soccerPhotos}`);
      console.log(`\n📊 TOTALS:`);
      console.log(`Total photos added: ${this.stats.totalPhotos}`);
      console.log(`Players updated: ${this.stats.playersUpdated}`);
      console.log(`Errors: ${this.stats.errors}`);
      
      await this.checkPhotoProgress();
      
    } catch (error) {
      console.error('Fatal error:', error);
    }
  }

  async collectNFLPhotos() {
    console.log('🏈 Collecting NFL player photos...\n');
    
    try {
      // Get ALL NFL players from Sleeper
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = Object.values(response.data);
      
      // Filter players with ESPN IDs
      const playersWithEspnIds = players
        .filter((p: any) => p.espn_id && (p.status === 'Active' || p.years_exp > 0))
        .slice(0, 2000); // Get up to 2000 players
      
      console.log(`Processing ${playersWithEspnIds.length} NFL players...`);
      
      const chunks = this.chunkArray(playersWithEspnIds, 100);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(player => limit(() => this.storeNFLPlayer(player)))
        );
        console.log(`  Processed ${chunk.length} players...`);
      }
      
    } catch (error) {
      console.error('NFL error:', error.message);
      this.stats.errors++;
    }
  }

  async storeNFLPlayer(player: any) {
    try {
      const photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id}.png&w=350&h=254`;
      
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
          years_exp: player.years_exp,
          draft_year: player.draft_year,
          draft_round: player.draft_round,
          draft_pick: player.draft_pick
        }
      };
      
      const { data, error } = await supabase
        .from('players')
        .upsert(playerData, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.playersUpdated++;
        this.stats.nflPhotos++;
        this.stats.totalPhotos++;
      }
    } catch (error) {
      // Skip individual errors
    }
  }

  async collectNBAPhotos() {
    console.log('\n🏀 Collecting NBA player photos...\n');
    
    try {
      // Get NBA rosters from ESPN
      const teams = [
        'lal', 'gsw', 'bos', 'mia', 'mil', 'den', 'phx', 'phi',
        'dal', 'mem', 'sac', 'no', 'ny', 'bkn', 'atl', 'chi',
        'cle', 'det', 'ind', 'orl', 'tor', 'wsh', 'cha', 'min',
        'okc', 'por', 'sa', 'utah', 'hou', 'lac'
      ];
      
      console.log(`Processing ${teams.length} NBA teams...`);
      
      for (const teamAbbr of teams) {
        await this.processNBATeam(teamAbbr);
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
          await this.storeNBAPlayer(player, response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamAbbr.toUpperCase()}: ${athletes.length} players`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async storeNBAPlayer(player: any, team: any) {
    try {
      const photoUrl = player.headshot?.href || 
        `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${player.id}.png&w=350&h=254`;
      
      const { data, error } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_nba_${player.id}`,
          name: player.displayName,
          firstname: player.firstName || player.displayName.split(' ')[0],
          lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
          position: player.position ? [player.position.abbreviation] : [],
          jersey_number: player.jersey ? parseInt(player.jersey) : null,
          team: team.displayName,
          team_abbreviation: team.abbreviation,
          heightinches: player.displayHeight ? this.parseHeight(player.displayHeight) : null,
          weightlbs: player.displayWeight ? parseInt(player.displayWeight) : null,
          birthdate: player.dateOfBirth || null,
          sport_id: 'nba',
          sport: 'basketball',
          photo_url: photoUrl,
          college: player.college?.name || null,
          metadata: {
            espn_id: player.id,
            experience: player.experience?.years,
            draft_year: player.draft?.year
          }
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.playersUpdated++;
        this.stats.nbaPhotos++;
        this.stats.totalPhotos++;
      }
    } catch (error) {
      // Skip
    }
  }

  async collectMLBPhotos() {
    console.log('\n⚾ Collecting MLB player photos...\n');
    
    try {
      // Get MLB teams
      const teams = [
        'nyy', 'bos', 'tb', 'bal', 'tor', 'min', 'cle', 'cws', 'det', 'kc',
        'hou', 'oak', 'tex', 'laa', 'sea', 'atl', 'phi', 'nym', 'mia', 'wsh',
        'mil', 'chc', 'stl', 'cin', 'pit', 'lad', 'sd', 'sf', 'col', 'ari'
      ];
      
      console.log(`Processing ${teams.length} MLB teams...`);
      
      for (const teamAbbr of teams.slice(0, 10)) { // First 10 teams
        await this.processMLBTeam(teamAbbr);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
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
          await this.storeMLBPlayer(player, response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamAbbr.toUpperCase()}: ${athletes.length} players`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async storeMLBPlayer(player: any, team: any) {
    try {
      const photoUrl = player.headshot?.href || 
        `https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/${player.id}.png&w=350&h=254`;
      
      const { data, error } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_mlb_${player.id}`,
          name: player.displayName,
          firstname: player.firstName || player.displayName.split(' ')[0],
          lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
          position: player.position ? [player.position.abbreviation] : [],
          jersey_number: player.jersey ? parseInt(player.jersey) : null,
          team: team.displayName,
          team_abbreviation: team.abbreviation,
          sport_id: 'mlb',
          sport: 'baseball',
          photo_url: photoUrl,
          metadata: {
            espn_id: player.id,
            bats: player.bats,
            throws: player.throws
          }
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.playersUpdated++;
        this.stats.mlbPhotos++;
        this.stats.totalPhotos++;
      }
    } catch (error) {
      // Skip
    }
  }

  async collectNHLPhotos() {
    console.log('\n🏒 Collecting NHL player photos...\n');
    
    try {
      // Get NHL teams
      const teams = [
        'bos', 'buf', 'det', 'fla', 'mtl', 'ott', 'tb', 'tor',
        'car', 'cbj', 'nj', 'nyi', 'nyr', 'phi', 'pit', 'wsh',
        'chi', 'col', 'dal', 'min', 'nsh', 'stl', 'wpg',
        'ana', 'ari', 'cgy', 'edm', 'la', 'sj', 'sea', 'van', 'vgk'
      ];
      
      console.log(`Processing ${teams.length} NHL teams...`);
      
      for (const teamAbbr of teams.slice(0, 10)) { // First 10 teams
        await this.processNHLTeam(teamAbbr);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
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
          await this.storeNHLPlayer(player, response.data.team);
        }
      }
      
      console.log(`  ✓ ${teamAbbr.toUpperCase()}: ${athletes.length} players`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async storeNHLPlayer(player: any, team: any) {
    try {
      const photoUrl = player.headshot?.href || 
        `https://a.espncdn.com/combiner/i?img=/i/headshots/nhl/players/full/${player.id}.png&w=350&h=254`;
      
      const { data, error } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_nhl_${player.id}`,
          name: player.displayName,
          firstname: player.firstName || player.displayName.split(' ')[0],
          lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
          position: player.position ? [player.position.abbreviation] : [],
          jersey_number: player.jersey ? parseInt(player.jersey) : null,
          team: team.displayName,
          team_abbreviation: team.abbreviation,
          sport_id: 'nhl',
          sport: 'hockey',
          photo_url: photoUrl,
          metadata: {
            espn_id: player.id,
            shoots: player.shoots
          }
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.playersUpdated++;
        this.stats.nhlPhotos++;
        this.stats.totalPhotos++;
      }
    } catch (error) {
      // Skip
    }
  }

  async collectSoccerPhotos() {
    console.log('\n⚽ Collecting Soccer player photos...\n');
    
    try {
      // Get top soccer leagues/teams
      const leagues = [
        { league: 'eng.1', name: 'Premier League' },
        { league: 'esp.1', name: 'La Liga' },
        { league: 'ger.1', name: 'Bundesliga' },
        { league: 'ita.1', name: 'Serie A' },
        { league: 'fra.1', name: 'Ligue 1' }
      ];
      
      for (const leagueInfo of leagues.slice(0, 2)) { // First 2 leagues
        console.log(`\nProcessing ${leagueInfo.name}...`);
        await this.processSoccerLeague(leagueInfo.league);
      }
      
    } catch (error) {
      console.error('Soccer error:', error.message);
      this.stats.errors++;
    }
  }

  async processSoccerLeague(leagueId: string) {
    try {
      // Get teams in league
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams`
      );
      
      const teams = response.data.sports?.[0]?.leagues?.[0]?.teams || [];
      
      for (const teamData of teams.slice(0, 5)) { // First 5 teams per league
        await this.processSoccerTeam(teamData.team, leagueId);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      }
      
    } catch (error) {
      // Skip league errors
    }
  }

  async processSoccerTeam(team: any, leagueId: string) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams/${team.id}/roster`
      );
      
      const athletes = response.data.athletes || [];
      
      for (const group of athletes) {
        for (const player of group.items || []) {
          await this.storeSoccerPlayer(player, team);
        }
      }
      
      console.log(`  ✓ ${team.displayName}: ${athletes.length} players`);
      
    } catch (error) {
      // Skip team errors
    }
  }

  async storeSoccerPlayer(player: any, team: any) {
    try {
      const photoUrl = player.headshot?.href || 
        `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${player.id}.png&w=350&h=254`;
      
      const { data, error } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_soccer_${player.id}`,
          name: player.displayName,
          firstname: player.firstName || player.displayName.split(' ')[0],
          lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
          position: player.position ? [player.position.displayName] : [],
          jersey_number: player.jersey ? parseInt(player.jersey) : null,
          team: team.displayName,
          team_abbreviation: team.abbreviation,
          sport_id: 'soccer',
          sport: 'soccer',
          photo_url: photoUrl,
          metadata: {
            espn_id: player.id,
            nationality: player.flag?.alt
          }
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (!error && data) {
        this.stats.playersUpdated++;
        this.stats.soccerPhotos++;
        this.stats.totalPhotos++;
      }
    } catch (error) {
      // Skip
    }
  }

  async updateExistingPlayersPhotos() {
    console.log('\n🔄 Updating photos for existing players...\n');
    
    try {
      // Get players without photos
      const { data: playersWithoutPhotos } = await supabase
        .from('players')
        .select('id, name, sport, metadata')
        .is('photo_url', null)
        .limit(1000);
      
      if (!playersWithoutPhotos?.length) {
        console.log('All players already have photos!');
        return;
      }
      
      console.log(`Found ${playersWithoutPhotos.length} players without photos`);
      
      const chunks = this.chunkArray(playersWithoutPhotos, 50);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(player => limit(() => this.tryFindPhoto(player)))
        );
      }
      
    } catch (error) {
      console.error('Update error:', error.message);
    }
  }

  async tryFindPhoto(player: any) {
    try {
      // Try to find ESPN ID in metadata
      const espnId = player.metadata?.espn_id;
      if (!espnId) return;
      
      let photoUrl = '';
      
      switch (player.sport) {
        case 'football':
          photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=350&h=254`;
          break;
        case 'basketball':
          photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=350&h=254`;
          break;
        case 'baseball':
          photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/${espnId}.png&w=350&h=254`;
          break;
        case 'hockey':
          photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nhl/players/full/${espnId}.png&w=350&h=254`;
          break;
      }
      
      if (photoUrl) {
        const { error } = await supabase
          .from('players')
          .update({ photo_url: photoUrl })
          .eq('id', player.id);
        
        if (!error) {
          this.stats.totalPhotos++;
          this.stats.playersUpdated++;
        }
      }
    } catch (error) {
      // Skip
    }
  }

  parseHeight(heightStr: string): number | null {
    // Convert "6' 3\"" to inches
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

  async checkPhotoProgress() {
    console.log('\n📊 PHOTO COVERAGE STATUS:');
    
    // Get counts by sport
    const sports = ['nfl', 'nba', 'mlb', 'nhl', 'soccer'];
    
    for (const sport of sports) {
      const { count: total } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport);
      
      const { count: withPhotos } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport)
        .not('photo_url', 'is', null);
      
      const coverage = total ? ((withPhotos || 0) / total * 100).toFixed(1) : '0';
      console.log(`${sport.toUpperCase()}: ${withPhotos || 0}/${total || 0} (${coverage}%)`);
    }
    
    // Overall stats
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalWithPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .not('photo_url', 'is', null);
    
    const overallCoverage = totalPlayers ? ((totalWithPhotos || 0) / totalPlayers * 100).toFixed(1) : '0';
    
    console.log(`\nOVERALL: ${totalWithPhotos || 0}/${totalPlayers || 0} (${overallCoverage}%)`);
  }
}

// Run it!
new MegaPhotoCollector().run();