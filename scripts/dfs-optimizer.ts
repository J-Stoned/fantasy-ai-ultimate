#!/usr/bin/env node
import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('💎 DFS OPTIMIZER - STATCAST EDITION');
console.log('🎯 Combining next-gen stats + weather + matchups for optimal lineups\n');

interface DFSPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projected_points: number;
  ownership_projection: number;
  value_score: number; // Points per $1000
  gpp_score: number; // Tournament upside
  cash_score: number; // Safety score
  key_factors: string[];
}

interface DFSLineup {
  players: DFSPlayer[];
  total_salary: number;
  projected_points: number;
  projected_ownership: number;
  lineup_type: 'CASH' | 'GPP' | 'BALANCED';
  stack?: string; // Team stack
  leverage_score: number; // How contrarian
}

interface PlayerProjection {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  // Statcast metrics
  xwoba: number;
  barrel_rate: number;
  hard_hit_rate: number;
  bat_speed?: number;
  sprint_speed?: number;
  // Matchup data
  opponent: string;
  opposing_pitcher?: string;
  pitcher_handedness?: 'L' | 'R';
  pitcher_xfip?: number;
  // Environmental
  park_factor: number;
  weather_score: number; // 1-10
  wind_direction?: string;
  temperature?: number;
  // Recent form
  xwoba_7d: number;
  hot_streak: boolean;
  // DFS specific
  salary: number;
  implied_runs: number;
  batting_order?: number;
}

class DFSOptimizer {
  private model: tf.LayersModel | null = null;
  private readonly SALARY_CAP = 50000; // DraftKings
  private readonly POSITIONS = ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'];
  
  async initialize() {
    console.log('🧠 Initializing DFS optimization model...\n');
    
    try {
      this.model = await tf.loadLayersModel('file://./models/dfs-optimizer/model.json');
      console.log('✅ Loaded existing DFS model');
    } catch (error) {
      console.log('📊 Creating new DFS optimization model...');
      this.model = this.createModel();
      console.log('✅ Model created successfully');
    }
  }
  
  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Input layer - 20 features
        tf.layers.dense({
          inputShape: [20],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        // Feature extraction layers
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        
        // Output - projected fantasy points
        tf.layers.dense({
          units: 1,
          activation: 'linear'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }
  
  async optimizeLineups(slate: 'MAIN' | 'TURBO' | 'NIGHT' = 'MAIN'): Promise<DFSLineup[]> {
    console.log(`🎯 Optimizing lineups for ${slate} slate...\n`);
    
    // Fetch player projections
    const projections = await this.fetchPlayerProjections(slate);
    console.log(`📊 Projecting ${projections.length} players...\n`);
    
    // Generate DFS scores for each player
    const dfsPlayers: DFSPlayer[] = [];
    
    for (const proj of projections) {
      const features = this.extractFeatures(proj);
      const projectedPoints = await this.projectPoints(features);
      
      const dfsPlayer = this.createDFSPlayer(proj, projectedPoints);
      dfsPlayers.push(dfsPlayer);
    }
    
    // Sort by value
    dfsPlayers.sort((a, b) => b.value_score - a.value_score);
    
    // Generate multiple lineup types
    const lineups: DFSLineup[] = [];
    
    // Cash game lineup (high floor)
    const cashLineup = this.optimizeCashLineup(dfsPlayers);
    if (cashLineup) lineups.push(cashLineup);
    
    // GPP lineups (high ceiling, lower ownership)
    for (let i = 0; i < 3; i++) {
      const gppLineup = this.optimizeGPPLineup(dfsPlayers, i);
      if (gppLineup) lineups.push(gppLineup);
    }
    
    // Balanced lineup
    const balancedLineup = this.optimizeBalancedLineup(dfsPlayers);
    if (balancedLineup) lineups.push(balancedLineup);
    
    return lineups;
  }
  
  private extractFeatures(proj: PlayerProjection): number[] {
    return [
      // Statcast excellence
      proj.xwoba / 0.400, // Normalized
      proj.barrel_rate / 15,
      proj.hard_hit_rate / 50,
      (proj.bat_speed || 72) / 80,
      
      // Recent form
      proj.xwoba_7d / 0.400,
      proj.hot_streak ? 1 : 0,
      
      // Matchup quality
      proj.pitcher_xfip ? (5 - proj.pitcher_xfip) / 5 : 0.5,
      proj.pitcher_handedness === 'L' ? 1 : 0, // Platoon advantage tracking
      
      // Environmental boost
      proj.park_factor,
      proj.weather_score / 10,
      proj.temperature ? Math.min((proj.temperature - 70) / 30, 1) : 0.5,
      
      // Batting order value
      proj.batting_order ? (10 - proj.batting_order) / 9 : 0,
      proj.implied_runs / 6, // Normalized to 6 runs
      
      // Value indicators
      proj.salary / 10000, // Normalized
      
      // Position scarcity (pitchers different scale)
      proj.position === 'P' ? 1 : 0,
      proj.position === 'C' ? 0.8 : 0,
      proj.position === 'SS' ? 0.7 : 0,
      
      // Sprint speed for SB upside
      (proj.sprint_speed || 27) / 30,
      
      // Team context
      proj.implied_runs > 5 ? 1 : 0, // High scoring game
      Math.random() // Randomness for GPP diversity
    ];
  }
  
  private async projectPoints(features: number[]): Promise<number> {
    if (!this.model) throw new Error('Model not initialized');
    
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const points = (await prediction.data())[0];
    
    input.dispose();
    prediction.dispose();
    
    return Math.max(0, points);
  }
  
  private createDFSPlayer(proj: PlayerProjection, projectedPoints: number): DFSPlayer {
    const keyFactors: string[] = [];
    
    // Identify key factors
    if (proj.xwoba > 0.370) keyFactors.push(`Elite xwOBA: ${proj.xwoba.toFixed(3)}`);
    if (proj.barrel_rate > 10) keyFactors.push(`High barrels: ${proj.barrel_rate.toFixed(1)}%`);
    if (proj.hot_streak) keyFactors.push('🔥 Hot streak');
    if (proj.weather_score > 8) keyFactors.push('Perfect weather');
    if (proj.implied_runs > 5.5) keyFactors.push(`Team total: ${proj.implied_runs.toFixed(1)}`);
    if (proj.batting_order && proj.batting_order <= 3) keyFactors.push(`Batting ${proj.batting_order}`);
    if (proj.pitcher_xfip && proj.pitcher_xfip > 4.5) keyFactors.push('Facing weak pitcher');
    
    // Calculate ownership projection
    let ownership = 10; // Base
    if (projectedPoints / (proj.salary / 1000) > 3.5) ownership += 10;
    if (proj.hot_streak) ownership += 5;
    if (keyFactors.length >= 3) ownership += 5;
    ownership = Math.min(ownership + Math.random() * 10, 40);
    
    // Calculate scores
    const valueScore = (projectedPoints / (proj.salary / 1000)) * 1000;
    const gppScore = projectedPoints * (1 + (40 - ownership) / 100); // Leverage low ownership
    const cashScore = projectedPoints * (1 - (projectedPoints > 20 ? 0.2 : 0)); // Penalize high variance
    
    return {
      player_id: proj.player_id,
      player_name: proj.player_name,
      position: proj.position,
      team: proj.team,
      opponent: proj.opponent,
      salary: proj.salary,
      projected_points: projectedPoints,
      ownership_projection: ownership,
      value_score: valueScore,
      gpp_score: gppScore,
      cash_score: cashScore,
      key_factors: keyFactors
    };
  }
  
  private optimizeCashLineup(players: DFSPlayer[]): DFSLineup | null {
    console.log('💰 Building cash game lineup (high floor)...');
    
    // Filter for cash game players (consistent, high floor)
    const cashPlayers = players
      .filter(p => p.cash_score > 8)
      .sort((a, b) => b.cash_score - a.cash_score);
    
    const lineup = this.buildLineup(cashPlayers, 'CASH');
    return lineup;
  }
  
  private optimizeGPPLineup(players: DFSPlayer[], variant: number): DFSLineup | null {
    console.log(`🏆 Building GPP lineup variant ${variant + 1} (high ceiling)...`);
    
    // Filter for GPP players (high upside, lower ownership)
    const gppPlayers = players
      .filter(p => p.gpp_score > 10 && p.ownership_projection < 25)
      .sort((a, b) => b.gpp_score - a.gpp_score);
    
    // Add some randomness for lineup diversity
    const shuffled = this.shuffleArray(gppPlayers.slice(0, 50));
    
    const lineup = this.buildLineup(shuffled, 'GPP');
    return lineup;
  }
  
  private optimizeBalancedLineup(players: DFSPlayer[]): DFSLineup | null {
    console.log('⚖️  Building balanced lineup...');
    
    // Mix of floor and ceiling
    const balancedPlayers = players
      .sort((a, b) => (b.cash_score + b.gpp_score) - (a.cash_score + a.gpp_score));
    
    const lineup = this.buildLineup(balancedPlayers, 'BALANCED');
    return lineup;
  }
  
  private buildLineup(players: DFSPlayer[], type: 'CASH' | 'GPP' | 'BALANCED'): DFSLineup | null {
    const lineup: DFSPlayer[] = [];
    const usedPositions: string[] = [];
    let totalSalary = 0;
    
    // Try to fill each position
    for (const requiredPos of this.POSITIONS) {
      const available = players.filter(p => {
        // Check if player fits position and isn't used
        const fitsPosition = this.playerFitsPosition(p.position, requiredPos);
        const notUsed = !lineup.some(l => l.player_id === p.player_id);
        const underCap = totalSalary + p.salary <= this.SALARY_CAP;
        
        return fitsPosition && notUsed && underCap;
      });
      
      if (available.length === 0) continue;
      
      // Pick best available
      const selected = available[0];
      lineup.push(selected);
      totalSalary += selected.salary;
    }
    
    // Validate lineup
    if (lineup.length !== this.POSITIONS.length) {
      return null;
    }
    
    // Calculate lineup metrics
    const projectedPoints = lineup.reduce((sum, p) => sum + p.projected_points, 0);
    const avgOwnership = lineup.reduce((sum, p) => sum + p.ownership_projection, 0) / lineup.length;
    
    // Check for stacks
    const teamCounts = new Map<string, number>();
    lineup.forEach(p => {
      teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
    });
    const stack = Array.from(teamCounts.entries())
      .find(([team, count]) => count >= 3)?.[0];
    
    return {
      players: lineup,
      total_salary: totalSalary,
      projected_points: projectedPoints,
      projected_ownership: avgOwnership,
      lineup_type: type,
      stack: stack,
      leverage_score: type === 'GPP' ? (40 - avgOwnership) / 40 : 0
    };
  }
  
  private playerFitsPosition(playerPos: string, requiredPos: string): boolean {
    if (playerPos === requiredPos) return true;
    if (requiredPos === 'OF' && ['LF', 'CF', 'RF', 'OF'].includes(playerPos)) return true;
    return false;
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  async fetchPlayerProjections(slate: string): Promise<PlayerProjection[]> {
    console.log('📊 Fetching player data and generating projections...');
    
    // In production, this would fetch from DFS sites and merge with our stats
    // For now, create mock projections using our Statcast data
    const { data: players, error } = await supabase
      .from('player_stats')
      .select('*')
      .in('stat_type', ['current_mlb_stats', 'statcast_hitting'])
      .order('stat_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching player data:', error);
      return [];
    }
    
    // Create projections
    const projections: PlayerProjection[] = [];
    const playerMap = new Map<string, any>();
    
    // Merge stats by player
    players?.forEach(record => {
      const playerId = record.stat_value?.player_id;
      if (!playerId) return;
      
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {});
      }
      
      const player = playerMap.get(playerId);
      Object.assign(player, record.stat_value);
    });
    
    // Convert to projections
    Array.from(playerMap.entries()).slice(0, 200).forEach(([playerId, stats]) => {
      if (!stats.expected_woba) return;
      
      projections.push({
        player_id: playerId,
        player_name: stats.player_name || 'Unknown',
        position: this.assignPosition(Math.random()), // Mock positions
        team: stats.team || 'MLB',
        xwoba: stats.expected_woba || 0.320,
        barrel_rate: stats.barrel_percent || 8,
        hard_hit_rate: stats.hard_hit_percent || 40,
        bat_speed: stats.bat_speed_avg,
        sprint_speed: 27 + Math.random() * 3,
        opponent: 'OPP',
        pitcher_xfip: 3.5 + Math.random() * 1.5,
        park_factor: 0.9 + Math.random() * 0.2,
        weather_score: Math.random() * 10,
        temperature: 65 + Math.random() * 25,
        xwoba_7d: stats.expected_woba + (Math.random() * 0.06 - 0.03),
        hot_streak: Math.random() > 0.7,
        salary: this.generateSalary(stats),
        implied_runs: 3.5 + Math.random() * 3,
        batting_order: Math.floor(Math.random() * 9) + 1
      });
    });
    
    console.log(`✅ Generated projections for ${projections.length} players`);
    return projections;
  }
  
  private assignPosition(rand: number): string {
    if (rand < 0.2) return 'P';
    if (rand < 0.25) return 'C';
    if (rand < 0.35) return '1B';
    if (rand < 0.45) return '2B';
    if (rand < 0.55) return '3B';
    if (rand < 0.65) return 'SS';
    return 'OF';
  }
  
  private generateSalary(stats: any): number {
    // Base salary on performance
    const base = 3000;
    const xwobaBonus = (stats.expected_woba || 0.320) * 10000;
    const barrelBonus = (stats.barrel_percent || 8) * 100;
    
    return Math.round((base + xwobaBonus + barrelBonus) / 100) * 100;
  }
  
  displayLineups(lineups: DFSLineup[]) {
    console.log('\n💎 OPTIMIZED DFS LINEUPS');
    console.log('=' .repeat(100));
    
    lineups.forEach((lineup, index) => {
      console.log(`\n📋 LINEUP ${index + 1} - ${lineup.lineup_type}`);
      console.log('-' .repeat(100));
      console.log(`Projected Points: ${lineup.projected_points.toFixed(1)} | Salary: $${lineup.total_salary.toLocaleString()} | Ownership: ${lineup.projected_ownership.toFixed(1)}%`);
      if (lineup.stack) console.log(`Stack: ${lineup.stack}`);
      if (lineup.lineup_type === 'GPP') console.log(`Leverage Score: ${(lineup.leverage_score * 100).toFixed(1)}%`);
      
      console.log('\nPOS | PLAYER                  | TEAM | OPP  | SALARY  | PROJ | OWN% | KEY FACTORS');
      console.log('-' .repeat(100));
      
      lineup.players.forEach(player => {
        const pos = player.position.padEnd(3);
        const name = player.player_name.substring(0, 22).padEnd(22);
        const team = player.team.padEnd(4);
        const opp = player.opponent.padEnd(4);
        const salary = `$${player.salary.toLocaleString()}`.padEnd(7);
        const proj = player.projected_points.toFixed(1).padEnd(4);
        const own = `${player.ownership_projection.toFixed(0)}%`.padEnd(4);
        const factors = player.key_factors.slice(0, 2).join(', ');
        
        console.log(`${pos} | ${name} | ${team} | ${opp} | ${salary} | ${proj} | ${own} | ${factors}`);
      });
      
      console.log('\n' + '=' .repeat(100));
    });
    
    console.log('\n💡 DFS STRATEGY TIPS:');
    console.log('• Cash Games: Focus on the high-floor lineup with consistent producers');
    console.log('• GPPs: Use low-ownership, high-upside lineups with leverage');
    console.log('• Monitor weather and lineup changes before lock');
    console.log('• Consider late swap opportunities based on our injury risk model\n');
  }
}

// Main execution
async function main() {
  const optimizer = new DFSOptimizer();
  
  try {
    // Initialize model
    await optimizer.initialize();
    
    // Generate optimized lineups
    const lineups = await optimizer.optimizeLineups('MAIN');
    
    if (lineups.length > 0) {
      optimizer.displayLineups(lineups);
    } else {
      console.log('Unable to generate valid lineups.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { DFSOptimizer };