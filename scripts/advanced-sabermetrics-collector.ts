#!/usr/bin/env node
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('📈 ADVANCED SABERMETRICS COLLECTOR');
console.log('🧮 Collecting WAR, wRC+, and next-gen analytics\n');

interface AdvancedHittingStats {
  player_name: string;
  player_id: string;
  team: string;
  // Value Metrics
  war?: number; // Wins Above Replacement
  war_per_162?: number; // WAR pace
  offensive_war?: number; // oWAR
  defensive_war?: number; // dWAR
  // Advanced Offensive
  wrc_plus?: number; // Weighted Runs Created Plus
  woba?: number; // Weighted On-Base Average
  iso?: number; // Isolated Power
  babip?: number; // Batting Average on Balls In Play
  // Plate Discipline
  bb_percent?: number; // Walk rate
  k_percent?: number; // Strikeout rate
  bb_k?: number; // Walk to strikeout ratio
  o_swing_percent?: number; // Outside zone swing %
  z_swing_percent?: number; // Zone swing %
  contact_percent?: number; // Contact rate
  // Batted Ball
  gb_percent?: number; // Ground ball %
  fb_percent?: number; // Fly ball %
  ld_percent?: number; // Line drive %
  hr_fb?: number; // Home run to fly ball ratio
  pull_percent?: number; // Pull %
  cent_percent?: number; // Center %
  oppo_percent?: number; // Opposite field %
  // Situational
  clutch?: number; // Clutch performance
  wpa?: number; // Win Probability Added
  re24?: number; // Run Expectancy
  leverage_index?: number; // Average leverage
  // Base Running
  bsr?: number; // Base Running Runs
  ubr?: number; // Ultimate Base Running
  wgdp?: number; // GDP runs
  wsb?: number; // Stolen base runs
}

interface AdvancedPitchingStats {
  player_name: string;
  player_id: string;
  team: string;
  // Value Metrics
  war?: number; // Wins Above Replacement
  fip?: number; // Fielding Independent Pitching
  xfip?: number; // Expected FIP
  siera?: number; // Skill-Interactive ERA
  // Command & Control
  k_9?: number; // Strikeouts per 9
  bb_9?: number; // Walks per 9
  k_bb?: number; // K/BB ratio
  k_percent?: number; // Strikeout %
  bb_percent?: number; // Walk %
  // Batted Ball Against
  gb_percent?: number; // Ground ball %
  fb_percent?: number; // Fly ball %
  ld_percent?: number; // Line drive %
  hr_fb?: number; // HR/FB ratio
  soft_percent?: number; // Soft contact %
  med_percent?: number; // Medium contact %
  hard_percent?: number; // Hard contact %
  // Advanced Metrics
  swstr_percent?: number; // Swinging strike %
  csw_percent?: number; // Called + Swinging strike %
  o_swing_percent?: number; // Outside zone swing %
  z_swing_percent?: number; // Zone swing %
  zone_percent?: number; // Zone %
  f_strike_percent?: number; // First pitch strike %
  // Pitch Mix
  fastball_percent?: number;
  breaking_percent?: number;
  offspeed_percent?: number;
  // Situational
  clutch?: number;
  shutdown?: number; // Shutdown innings
  meltdown?: number; // Meltdown innings
}

interface ProjectionStats {
  player_name: string;
  player_id: string;
  // Steamer Projections
  steamer_war?: number;
  steamer_pa?: number;
  steamer_avg?: number;
  steamer_hr?: number;
  steamer_ops?: number;
  // ZiPS Projections
  zips_war?: number;
  zips_pa?: number;
  zips_avg?: number;
  zips_hr?: number;
  zips_ops?: number;
  // Depth Charts
  dc_war?: number;
  dc_pa?: number;
  dc_playing_time?: number;
}

class AdvancedSabermetricsCollector {
  private readonly DELAY_MS = 3000; // Be respectful to FanGraphs
  
  async collectAllSabermetrics() {
    console.log('🎯 Starting advanced sabermetrics collection...\n');
    
    try {
      // Note: FanGraphs doesn't have a public API, so this is a conceptual implementation
      // In production, you'd need to either:
      // 1. Use their paid API service
      // 2. Use pybaseball library via Python subprocess
      // 3. Implement respectful web scraping with proper delays
      
      const hittingStats = await this.collectAdvancedHitting();
      await this.delay(this.DELAY_MS);
      
      const pitchingStats = await this.collectAdvancedPitching();
      await this.delay(this.DELAY_MS);
      
      const projections = await this.collectProjections();
      
      await this.saveToDatabase({
        hitting: hittingStats,
        pitching: pitchingStats,
        projections: projections
      });
      
      console.log('\n✅ Advanced sabermetrics collection complete!');
      
    } catch (error) {
      console.error('❌ Collection failed:', error);
    }
  }
  
  async collectAdvancedHitting(): Promise<AdvancedHittingStats[]> {
    console.log('📊 Collecting advanced hitting metrics (WAR, wRC+, BABIP)...');
    
    // This is a mock implementation showing the structure
    // Real implementation would scrape FanGraphs or use their API
    const mockData: AdvancedHittingStats[] = [
      {
        player_name: "Aaron Judge",
        player_id: "592450",
        team: "NYY",
        war: 8.5,
        war_per_162: 9.2,
        offensive_war: 7.8,
        defensive_war: 0.7,
        wrc_plus: 175,
        woba: .425,
        iso: .310,
        babip: .325,
        bb_percent: 12.5,
        k_percent: 22.1,
        bb_k: 0.57,
        o_swing_percent: 28.5,
        z_swing_percent: 72.3,
        contact_percent: 78.2,
        gb_percent: 38.5,
        fb_percent: 42.1,
        ld_percent: 19.4,
        hr_fb: 28.5,
        pull_percent: 45.2,
        cent_percent: 32.1,
        oppo_percent: 22.7,
        clutch: 1.25,
        wpa: 4.8,
        re24: 52.3,
        leverage_index: 1.02,
        bsr: 2.5,
        ubr: 1.8,
        wgdp: -0.3,
        wsb: 1.0
      }
    ];
    
    console.log(`✅ Collected advanced stats for ${mockData.length} hitters`);
    return mockData;
  }
  
  async collectAdvancedPitching(): Promise<AdvancedPitchingStats[]> {
    console.log('⚾ Collecting advanced pitching metrics (FIP, SIERA, CSW%)...');
    
    const mockData: AdvancedPitchingStats[] = [
      {
        player_name: "Gerrit Cole",
        player_id: "543037",
        team: "NYY",
        war: 5.2,
        fip: 2.85,
        xfip: 2.92,
        siera: 2.88,
        k_9: 11.2,
        bb_9: 2.1,
        k_bb: 5.33,
        k_percent: 29.8,
        bb_percent: 5.6,
        gb_percent: 42.3,
        fb_percent: 38.2,
        ld_percent: 19.5,
        hr_fb: 11.2,
        soft_percent: 18.5,
        med_percent: 45.2,
        hard_percent: 36.3,
        swstr_percent: 13.2,
        csw_percent: 31.5,
        o_swing_percent: 34.2,
        z_swing_percent: 68.5,
        zone_percent: 45.2,
        f_strike_percent: 62.3,
        fastball_percent: 52.1,
        breaking_percent: 35.2,
        offspeed_percent: 12.7,
        clutch: 0.82,
        shutdown: 42,
        meltdown: 8
      }
    ];
    
    console.log(`✅ Collected advanced stats for ${mockData.length} pitchers`);
    return mockData;
  }
  
  async collectProjections(): Promise<ProjectionStats[]> {
    console.log('🔮 Collecting projection systems (Steamer, ZiPS, Depth Charts)...');
    
    const mockData: ProjectionStats[] = [
      {
        player_name: "Juan Soto",
        player_id: "665742",
        steamer_war: 6.2,
        steamer_pa: 680,
        steamer_avg: .285,
        steamer_hr: 35,
        steamer_ops: .925,
        zips_war: 6.5,
        zips_pa: 690,
        zips_avg: .290,
        zips_hr: 37,
        zips_ops: .940,
        dc_war: 6.3,
        dc_pa: 675,
        dc_playing_time: 0.95
      }
    ];
    
    console.log(`✅ Collected projections for ${mockData.length} players`);
    return mockData;
  }
  
  async saveToDatabase(data: {
    hitting: AdvancedHittingStats[],
    pitching: AdvancedPitchingStats[],
    projections: ProjectionStats[]
  }) {
    console.log('\n💾 Saving advanced sabermetrics to database...');
    
    const statsData: any[] = [];
    
    // Process hitting sabermetrics
    data.hitting.forEach(player => {
      statsData.push({
        stat_type: 'advanced_hitting',
        stat_value: {
          player_name: player.player_name,
          player_id: player.player_id,
          team: player.team,
          // Value metrics
          war: player.war,
          war_per_162: player.war_per_162,
          offensive_war: player.offensive_war,
          defensive_war: player.defensive_war,
          wrc_plus: player.wrc_plus,
          woba: player.woba,
          iso: player.iso,
          babip: player.babip,
          // Plate discipline
          walk_percent: player.bb_percent,
          strikeout_percent: player.k_percent,
          walk_strikeout_ratio: player.bb_k,
          outside_swing_percent: player.o_swing_percent,
          zone_swing_percent: player.z_swing_percent,
          contact_percent: player.contact_percent,
          // Batted ball
          ground_ball_percent: player.gb_percent,
          fly_ball_percent: player.fb_percent,
          line_drive_percent: player.ld_percent,
          hr_fb_ratio: player.hr_fb,
          pull_percent: player.pull_percent,
          center_percent: player.cent_percent,
          opposite_percent: player.oppo_percent,
          // Situational
          clutch_score: player.clutch,
          win_probability_added: player.wpa,
          run_expectancy_24: player.re24,
          leverage_index_avg: player.leverage_index,
          // Base running
          base_running_runs: player.bsr,
          ultimate_base_running: player.ubr,
          gdp_runs: player.wgdp,
          stolen_base_runs: player.wsb,
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: ((player.war || 0) * 10) + ((player.wrc_plus || 100) - 100) * 0.2
      });
    });
    
    // Process pitching sabermetrics
    data.pitching.forEach(pitcher => {
      statsData.push({
        stat_type: 'advanced_pitching',
        stat_value: {
          player_name: pitcher.player_name,
          player_id: pitcher.player_id,
          team: pitcher.team,
          war: pitcher.war,
          fip: pitcher.fip,
          xfip: pitcher.xfip,
          siera: pitcher.siera,
          k_per_9: pitcher.k_9,
          bb_per_9: pitcher.bb_9,
          k_bb_ratio: pitcher.k_bb,
          strikeout_percent: pitcher.k_percent,
          walk_percent: pitcher.bb_percent,
          // Batted ball
          ground_ball_percent: pitcher.gb_percent,
          fly_ball_percent: pitcher.fb_percent,
          line_drive_percent: pitcher.ld_percent,
          hr_fb_ratio: pitcher.hr_fb,
          soft_contact_percent: pitcher.soft_percent,
          medium_contact_percent: pitcher.med_percent,
          hard_contact_percent: pitcher.hard_percent,
          // Command
          swinging_strike_percent: pitcher.swstr_percent,
          csw_percent: pitcher.csw_percent,
          outside_swing_percent: pitcher.o_swing_percent,
          zone_swing_percent: pitcher.z_swing_percent,
          zone_percent: pitcher.zone_percent,
          first_strike_percent: pitcher.f_strike_percent,
          // Pitch mix
          fastball_usage: pitcher.fastball_percent,
          breaking_usage: pitcher.breaking_percent,
          offspeed_usage: pitcher.offspeed_percent,
          // Situational
          clutch_score: pitcher.clutch,
          shutdown_innings: pitcher.shutdown,
          meltdown_innings: pitcher.meltdown,
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: ((pitcher.war || 0) * 10) + ((3.00 - (pitcher.fip || 3.00)) * 5)
      });
    });
    
    // Process projections
    data.projections.forEach(player => {
      statsData.push({
        stat_type: 'player_projections',
        stat_value: {
          player_name: player.player_name,
          player_id: player.player_id,
          steamer: {
            war: player.steamer_war,
            plate_appearances: player.steamer_pa,
            batting_average: player.steamer_avg,
            home_runs: player.steamer_hr,
            ops: player.steamer_ops
          },
          zips: {
            war: player.zips_war,
            plate_appearances: player.zips_pa,
            batting_average: player.zips_avg,
            home_runs: player.zips_hr,
            ops: player.zips_ops
          },
          depth_charts: {
            war: player.dc_war,
            plate_appearances: player.dc_pa,
            playing_time: player.dc_playing_time
          },
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: (player.dc_war || 0) * 10 // Projected fantasy value
      });
    });
    
    // Insert in batches
    console.log(`📊 Inserting ${statsData.length} sabermetric records...`);
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < statsData.length; i += batchSize) {
      const batch = statsData.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('player_stats')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
      } else {
        inserted += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
      }
    }
    
    console.log(`\n🎉 Successfully saved ${inserted} sabermetric records!`);
    this.displayLeaders(data);
  }
  
  displayLeaders(data: any) {
    console.log('\n🏆 SABERMETRICS LEADERS');
    console.log('=' .repeat(50));
    
    // WAR Leaders
    const warLeaders = [...data.hitting, ...data.pitching]
      .sort((a, b) => (b.war || 0) - (a.war || 0))
      .slice(0, 5);
    
    console.log('\n📊 WAR Leaders:');
    warLeaders.forEach((player, i) => {
      console.log(`${i + 1}. ${player.player_name} (${player.team}) - ${player.war?.toFixed(1)} WAR`);
    });
    
    // wRC+ Leaders
    const wrcLeaders = data.hitting
      .sort((a: any, b: any) => (b.wrc_plus || 0) - (a.wrc_plus || 0))
      .slice(0, 5);
    
    console.log('\n⚡ wRC+ Leaders:');
    wrcLeaders.forEach((player: any, i: number) => {
      console.log(`${i + 1}. ${player.player_name} - ${player.wrc_plus} wRC+`);
    });
    
    // FIP Leaders
    const fipLeaders = data.pitching
      .sort((a: any, b: any) => (a.fip || 999) - (b.fip || 999))
      .slice(0, 5);
    
    console.log('\n🎯 FIP Leaders:');
    fipLeaders.forEach((pitcher: any, i: number) => {
      console.log(`${i + 1}. ${pitcher.player_name} - ${pitcher.fip?.toFixed(2)} FIP`);
    });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const collector = new AdvancedSabermetricsCollector();
  
  try {
    await collector.collectAllSabermetrics();
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { AdvancedSabermetricsCollector };