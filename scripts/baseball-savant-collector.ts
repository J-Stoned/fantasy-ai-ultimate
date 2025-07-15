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

console.log('⚾ BASEBALL SAVANT STATCAST COLLECTOR');
console.log('🚀 Collecting next-generation MLB statistics\n');

interface StatcastHitting {
  player_name: string;
  player_id: string;
  team: string;
  // Expected Statistics
  xba?: number; // Expected Batting Average
  xslg?: number; // Expected Slugging
  xwoba?: number; // Expected Weighted On-Base Average
  xwobacon?: number; // Expected wOBA on Contact
  // Batted Ball Quality
  exit_velocity_avg?: number;
  exit_velocity_max?: number;
  hard_hit_percent?: number;
  barrel_percent?: number;
  sweet_spot_percent?: number;
  // Launch Angle
  launch_angle_avg?: number;
  ground_ball_percent?: number;
  fly_ball_percent?: number;
  line_drive_percent?: number;
  // Distance
  distance_max?: number;
  distance_avg?: number;
  hr_distance_avg?: number;
  // New Bat Tracking (2024)
  bat_speed_avg?: number;
  swing_length?: number;
  squared_up_rate?: number;
  fast_swing_percent?: number;
  competitive_swing_percent?: number;
  blasts?: number;
  swords?: number;
}

interface StatcastPitching {
  player_name: string;
  player_id: string;
  team: string;
  // Expected Stats
  xera?: number; // Expected ERA
  xwoba_against?: number;
  xfip?: number;
  // Pitch Movement & Spin
  spin_rate_avg?: number;
  active_spin_percent?: number;
  extension?: number;
  release_height?: number;
  effective_velocity?: number;
  // Pitch Arsenal
  pitch_types?: string[];
  pitch_usage?: Record<string, number>;
  pitch_velocity?: Record<string, number>;
  pitch_movement?: Record<string, { horizontal: number; vertical: number }>;
}

interface StatcastFielding {
  player_name: string;
  player_id: string;
  team: string;
  position: string;
  // Defensive Metrics
  outs_above_average?: number;
  success_rate?: number;
  arm_strength?: number;
  arm_value?: number;
  pop_time?: number; // Catchers
  framing_runs?: number; // Catchers
  // Outfield Specific
  catch_probability_avg?: number;
  reaction_time?: number;
  route_efficiency?: number;
  jump?: number;
}

interface StatcastRunning {
  player_name: string;
  player_id: string;
  team: string;
  // Speed Metrics
  sprint_speed?: number;
  hp_to_1b?: number; // Home to first time
  baserunning_runs?: number;
  // Stolen Base Metrics
  stolen_base_percent?: number;
  lead_distance_avg?: number;
  secondary_lead_avg?: number;
  steal_rate?: number;
}

class BaseballSavantCollector {
  private readonly SAVANT_BASE_URL = 'https://baseballsavant.mlb.com';
  private readonly DELAY_MS = 2000; // Rate limiting
  
  async collectAllStatcastData() {
    console.log('🎯 Starting comprehensive Statcast data collection...\n');
    
    try {
      // Collect all categories in sequence (rate limiting)
      const expectedStats = await this.collectExpectedStats();
      await this.delay(this.DELAY_MS);
      
      const batTrackingStats = await this.collectBatTracking();
      await this.delay(this.DELAY_MS);
      
      const pitchingStats = await this.collectPitchingStatcast();
      await this.delay(this.DELAY_MS);
      
      const fieldingStats = await this.collectFieldingMetrics();
      await this.delay(this.DELAY_MS);
      
      const runningStats = await this.collectSprintSpeed();
      
      // Save all data to database
      await this.saveToDatabase({
        hitting: expectedStats.concat(batTrackingStats),
        pitching: pitchingStats,
        fielding: fieldingStats,
        running: runningStats
      });
      
      console.log('\n✅ Statcast collection complete!');
      
    } catch (error) {
      console.error('❌ Collection failed:', error);
    }
  }
  
  async collectExpectedStats(): Promise<StatcastHitting[]> {
    console.log('📊 Collecting Expected Statistics (xBA, xwOBA, xSLG)...');
    
    try {
      const url = `${this.SAVANT_BASE_URL}/leaderboard/expected_statistics`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const players: StatcastHitting[] = [];
      
      // Parse the leaderboard table
      $('table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const player: StatcastHitting = {
            player_name: $(cells[1]).text().trim(),
            player_id: $(cells[1]).find('a').attr('href')?.split('/').pop() || '',
            team: $(cells[2]).text().trim(),
            xba: parseFloat($(cells[5]).text()) || undefined,
            xslg: parseFloat($(cells[7]).text()) || undefined,
            xwoba: parseFloat($(cells[9]).text()) || undefined,
            xwobacon: parseFloat($(cells[11]).text()) || undefined,
            exit_velocity_avg: parseFloat($(cells[13]).text()) || undefined,
            hard_hit_percent: parseFloat($(cells[14]).text()) || undefined,
            barrel_percent: parseFloat($(cells[15]).text()) || undefined,
            sweet_spot_percent: parseFloat($(cells[16]).text()) || undefined,
            launch_angle_avg: parseFloat($(cells[17]).text()) || undefined,
          };
          players.push(player);
        }
      });
      
      console.log(`✅ Collected expected stats for ${players.length} players`);
      return players.slice(0, 100); // Top 100
      
    } catch (error) {
      console.error('❌ Expected stats collection failed:', error);
      return [];
    }
  }
  
  async collectBatTracking(): Promise<StatcastHitting[]> {
    console.log('🏏 Collecting Bat Tracking Metrics (NEW 2024!)...');
    
    try {
      const url = `${this.SAVANT_BASE_URL}/leaderboard/bat-tracking`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const players: StatcastHitting[] = [];
      
      // Parse bat tracking data
      $('table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const player: StatcastHitting = {
            player_name: $(cells[1]).text().trim(),
            player_id: $(cells[1]).find('a').attr('href')?.split('/').pop() || '',
            team: $(cells[2]).text().trim(),
            bat_speed_avg: parseFloat($(cells[4]).text()) || undefined,
            swing_length: parseFloat($(cells[5]).text()) || undefined,
            squared_up_rate: parseFloat($(cells[6]).text()) || undefined,
            fast_swing_percent: parseFloat($(cells[7]).text()) || undefined,
            competitive_swing_percent: parseFloat($(cells[8]).text()) || undefined,
            blasts: parseInt($(cells[9]).text()) || undefined,
            swords: parseInt($(cells[10]).text()) || undefined,
          };
          players.push(player);
        }
      });
      
      console.log(`✅ Collected bat tracking for ${players.length} players`);
      return players.slice(0, 100);
      
    } catch (error) {
      console.error('❌ Bat tracking collection failed:', error);
      return [];
    }
  }
  
  async collectPitchingStatcast(): Promise<StatcastPitching[]> {
    console.log('⚾ Collecting Pitching Statcast Metrics...');
    
    try {
      // For pitching we'd need to scrape multiple pages
      // This is a simplified version - in production we'd want more comprehensive data
      const url = `${this.SAVANT_BASE_URL}/leaderboard/pitch-arsenals`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const pitchers: StatcastPitching[] = [];
      
      // Parse pitching data
      $('table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const pitcher: StatcastPitching = {
            player_name: $(cells[1]).text().trim(),
            player_id: $(cells[1]).find('a').attr('href')?.split('/').pop() || '',
            team: $(cells[2]).text().trim(),
            spin_rate_avg: parseFloat($(cells[4]).text()) || undefined,
            extension: parseFloat($(cells[5]).text()) || undefined,
            release_height: parseFloat($(cells[6]).text()) || undefined,
            effective_velocity: parseFloat($(cells[7]).text()) || undefined,
          };
          pitchers.push(pitcher);
        }
      });
      
      console.log(`✅ Collected pitching metrics for ${pitchers.length} players`);
      return pitchers.slice(0, 100);
      
    } catch (error) {
      console.error('❌ Pitching metrics collection failed:', error);
      return [];
    }
  }
  
  async collectFieldingMetrics(): Promise<StatcastFielding[]> {
    console.log('🧤 Collecting Fielding Metrics (OAA, Arm Strength)...');
    
    try {
      const url = `${this.SAVANT_BASE_URL}/leaderboard/outs_above_average`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const fielders: StatcastFielding[] = [];
      
      // Parse fielding data
      $('table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const fielder: StatcastFielding = {
            player_name: $(cells[1]).text().trim(),
            player_id: $(cells[1]).find('a').attr('href')?.split('/').pop() || '',
            team: $(cells[2]).text().trim(),
            position: $(cells[3]).text().trim(),
            outs_above_average: parseFloat($(cells[4]).text()) || undefined,
            success_rate: parseFloat($(cells[5]).text()) || undefined,
            arm_strength: parseFloat($(cells[6]).text()) || undefined,
          };
          fielders.push(fielder);
        }
      });
      
      console.log(`✅ Collected fielding metrics for ${fielders.length} players`);
      return fielders.slice(0, 100);
      
    } catch (error) {
      console.error('❌ Fielding metrics collection failed:', error);
      return [];
    }
  }
  
  async collectSprintSpeed(): Promise<StatcastRunning[]> {
    console.log('🏃 Collecting Sprint Speed & Running Metrics...');
    
    try {
      const url = `${this.SAVANT_BASE_URL}/leaderboard/sprint_speed`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const runners: StatcastRunning[] = [];
      
      // Parse running data
      $('table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const runner: StatcastRunning = {
            player_name: $(cells[1]).text().trim(),
            player_id: $(cells[1]).find('a').attr('href')?.split('/').pop() || '',
            team: $(cells[2]).text().trim(),
            sprint_speed: parseFloat($(cells[4]).text()) || undefined,
            hp_to_1b: parseFloat($(cells[5]).text()) || undefined,
            baserunning_runs: parseFloat($(cells[6]).text()) || undefined,
          };
          runners.push(runner);
        }
      });
      
      console.log(`✅ Collected running metrics for ${runners.length} players`);
      return runners.slice(0, 100);
      
    } catch (error) {
      console.error('❌ Running metrics collection failed:', error);
      return [];
    }
  }
  
  async saveToDatabase(data: {
    hitting: StatcastHitting[],
    pitching: StatcastPitching[],
    fielding: StatcastFielding[],
    running: StatcastRunning[]
  }) {
    console.log('\n💾 Saving Statcast data to database...');
    
    const statsData: any[] = [];
    
    // Process hitting stats
    data.hitting.forEach(player => {
      if (player.xba || player.xwoba || player.bat_speed_avg) {
        statsData.push({
          stat_type: 'statcast_hitting',
          stat_value: {
            player_name: player.player_name,
            player_id: player.player_id,
            team: player.team,
            // Expected Stats
            expected_batting_average: player.xba,
            expected_slugging: player.xslg,
            expected_woba: player.xwoba,
            expected_woba_contact: player.xwobacon,
            // Batted Ball
            exit_velocity_avg: player.exit_velocity_avg,
            exit_velocity_max: player.exit_velocity_max,
            hard_hit_percent: player.hard_hit_percent,
            barrel_percent: player.barrel_percent,
            sweet_spot_percent: player.sweet_spot_percent,
            launch_angle_avg: player.launch_angle_avg,
            // Bat Tracking
            bat_speed_avg: player.bat_speed_avg,
            swing_length: player.swing_length,
            squared_up_rate: player.squared_up_rate,
            fast_swing_percent: player.fast_swing_percent,
            blasts: player.blasts,
            swords: player.swords,
            season: 2025,
            stat_date: new Date().toISOString()
          },
          // Fantasy scoring based on expected stats
          fantasy_points: ((player.xwoba || 0) * 100) + ((player.barrel_percent || 0) * 2)
        });
      }
    });
    
    // Process pitching stats
    data.pitching.forEach(pitcher => {
      statsData.push({
        stat_type: 'statcast_pitching',
        stat_value: {
          player_name: pitcher.player_name,
          player_id: pitcher.player_id,
          team: pitcher.team,
          expected_era: pitcher.xera,
          expected_woba_against: pitcher.xwoba_against,
          expected_fip: pitcher.xfip,
          spin_rate_avg: pitcher.spin_rate_avg,
          active_spin_percent: pitcher.active_spin_percent,
          extension: pitcher.extension,
          release_height: pitcher.release_height,
          effective_velocity: pitcher.effective_velocity,
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: 0 // Calculate based on your scoring system
      });
    });
    
    // Process fielding stats
    data.fielding.forEach(fielder => {
      statsData.push({
        stat_type: 'statcast_fielding',
        stat_value: {
          player_name: fielder.player_name,
          player_id: fielder.player_id,
          team: fielder.team,
          position: fielder.position,
          outs_above_average: fielder.outs_above_average,
          success_rate: fielder.success_rate,
          arm_strength: fielder.arm_strength,
          arm_value: fielder.arm_value,
          pop_time: fielder.pop_time,
          framing_runs: fielder.framing_runs,
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: (fielder.outs_above_average || 0) * 0.5
      });
    });
    
    // Process running stats
    data.running.forEach(runner => {
      statsData.push({
        stat_type: 'statcast_running',
        stat_value: {
          player_name: runner.player_name,
          player_id: runner.player_id,
          team: runner.team,
          sprint_speed: runner.sprint_speed,
          hp_to_1b: runner.hp_to_1b,
          baserunning_runs: runner.baserunning_runs,
          stolen_base_percent: runner.stolen_base_percent,
          season: 2025,
          stat_date: new Date().toISOString()
        },
        fantasy_points: ((runner.sprint_speed || 0) - 25) * 2 // Bonus for elite speed
      });
    });
    
    // Insert in batches
    console.log(`📊 Inserting ${statsData.length} Statcast records...`);
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
    
    console.log(`\n🎉 Successfully saved ${inserted} Statcast records!`);
    this.displaySummary(data);
  }
  
  displaySummary(data: any) {
    console.log('\n🏆 STATCAST COLLECTION SUMMARY');
    console.log('=' .repeat(50));
    
    // Find leaders in key categories
    const xwOBALeader = data.hitting.reduce((prev: any, current: any) => 
      (current.xwoba > (prev?.xwoba || 0)) ? current : prev, null);
    
    const batSpeedLeader = data.hitting.reduce((prev: any, current: any) => 
      (current.bat_speed_avg > (prev?.bat_speed_avg || 0)) ? current : prev, null);
    
    const sprintSpeedLeader = data.running.reduce((prev: any, current: any) => 
      (current.sprint_speed > (prev?.sprint_speed || 0)) ? current : prev, null);
    
    if (xwOBALeader) {
      console.log(`\n🎯 xwOBA Leader: ${xwOBALeader.player_name} - ${xwOBALeader.xwoba?.toFixed(3)}`);
    }
    
    if (batSpeedLeader) {
      console.log(`⚡ Bat Speed Leader: ${batSpeedLeader.player_name} - ${batSpeedLeader.bat_speed_avg?.toFixed(1)} MPH`);
    }
    
    if (sprintSpeedLeader) {
      console.log(`🏃 Sprint Speed Leader: ${sprintSpeedLeader.player_name} - ${sprintSpeedLeader.sprint_speed?.toFixed(1)} ft/sec`);
    }
    
    console.log(`\n📊 Total Records Collected:`);
    console.log(`- Hitting/Expected Stats: ${data.hitting.length}`);
    console.log(`- Pitching Metrics: ${data.pitching.length}`);
    console.log(`- Fielding Metrics: ${data.fielding.length}`);
    console.log(`- Running Metrics: ${data.running.length}`);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const collector = new BaseballSavantCollector();
  
  try {
    await collector.collectAllStatcastData();
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { BaseballSavantCollector };