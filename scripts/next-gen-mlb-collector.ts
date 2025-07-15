#!/usr/bin/env node
import { BaseballSavantCollector } from './baseball-savant-collector';
import { AdvancedSabermetricsCollector } from './advanced-sabermetrics-collector';
import { CurrentMLBStatsCollector } from './current-mlb-stats-collector';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('🚀 NEXT-GENERATION MLB STATS COLLECTOR');
console.log('⚡ Combining traditional + Statcast + sabermetrics\n');

class NextGenMLBCollector {
  private currentStatsCollector: CurrentMLBStatsCollector;
  private savantCollector: BaseballSavantCollector;
  private sabermetricsCollector: AdvancedSabermetricsCollector;
  
  constructor() {
    this.currentStatsCollector = new CurrentMLBStatsCollector();
    this.savantCollector = new BaseballSavantCollector();
    this.sabermetricsCollector = new AdvancedSabermetricsCollector();
  }
  
  async collectAllStats() {
    console.log('🎯 Starting comprehensive next-gen MLB stats collection...\n');
    console.log('This will collect:');
    console.log('• Traditional stats (HR, RBI, AVG, etc.)');
    console.log('• Statcast metrics (xwOBA, barrels, bat speed)');
    console.log('• Advanced sabermetrics (WAR, wRC+, FIP)');
    console.log('• Fielding & running metrics (OAA, sprint speed)\n');
    
    try {
      // Phase 1: Current season traditional stats
      console.log('📊 PHASE 1: Traditional Statistics');
      console.log('=' .repeat(50));
      const traditionalStats = await this.currentStatsCollector.collectCurrentStats();
      console.log(`✅ Collected ${traditionalStats.length} players with traditional stats\n`);
      
      // Phase 2: Statcast next-gen metrics
      console.log('⚡ PHASE 2: Statcast Metrics');
      console.log('=' .repeat(50));
      await this.savantCollector.collectAllStatcastData();
      console.log('✅ Statcast collection complete\n');
      
      // Phase 3: Advanced sabermetrics
      console.log('🧮 PHASE 3: Advanced Sabermetrics');
      console.log('=' .repeat(50));
      await this.sabermetricsCollector.collectAllSabermetrics();
      console.log('✅ Sabermetrics collection complete\n');
      
      // Summary
      this.displayCollectionSummary();
      
    } catch (error) {
      console.error('❌ Collection failed:', error);
    }
  }
  
  async collectSpecificCategory(category: 'traditional' | 'statcast' | 'sabermetrics') {
    console.log(`🎯 Collecting ${category} statistics...\n`);
    
    try {
      switch (category) {
        case 'traditional':
          await this.currentStatsCollector.collectCurrentStats();
          break;
        case 'statcast':
          await this.savantCollector.collectAllStatcastData();
          break;
        case 'sabermetrics':
          await this.sabermetricsCollector.collectAllSabermetrics();
          break;
      }
      
      console.log(`✅ ${category} collection complete!\n`);
      
    } catch (error) {
      console.error(`❌ ${category} collection failed:`, error);
    }
  }
  
  displayCollectionSummary() {
    console.log('\n🏆 NEXT-GEN MLB STATS COLLECTION COMPLETE!');
    console.log('=' .repeat(60));
    
    console.log('\n📊 Data Categories Collected:');
    console.log('✅ Traditional Stats: HR, RBI, AVG, R, H, 2B, 3B, BB, K, SB, OPS');
    console.log('✅ Pitching Stats: W, L, ERA, K, SV, WHIP, IP');
    console.log('✅ Expected Stats: xBA, xSLG, xwOBA, xwOBAcon');
    console.log('✅ Batted Ball: Exit Velocity, Launch Angle, Barrels, Hard Hit %');
    console.log('✅ Bat Tracking: Bat Speed, Swing Length, Squared-Up Rate (2024 NEW!)');
    console.log('✅ Advanced Hitting: WAR, wRC+, wOBA, ISO, BABIP');
    console.log('✅ Advanced Pitching: FIP, xFIP, SIERA, K/9, BB/9, CSW%');
    console.log('✅ Fielding: OAA, Arm Strength, Pop Time, Framing');
    console.log('✅ Running: Sprint Speed, HP to 1B, Baserunning Runs');
    
    console.log('\n🚀 System Capabilities:');
    console.log('• 50+ unique statistical categories');
    console.log('• Instant query responses via fast-path patterns');
    console.log('• Professional-grade analytics matching MLB front offices');
    console.log('• Schema-compliant storage in existing database');
    
    console.log('\n💡 Fantasy Applications:');
    console.log('• Predictive power: xStats vs actual performance gaps');
    console.log('• Breakout detection: Bat speed + barrel improvements');
    console.log('• Value finding: High WAR players with low ownership');
    console.log('• Injury prevention: Swing mechanics degradation');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Run queries like "who has the highest xwOBA?"');
    console.log('2. Compare expected vs actual stats for buy-low candidates');
    console.log('3. Identify bat speed breakouts before the market');
    console.log('4. Use advanced metrics for superior fantasy decisions');
    
    console.log('\n=' .repeat(60));
    console.log('🏆 Your fantasy baseball system now has MLB front office analytics! 🏆\n');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const collector = new NextGenMLBCollector();
  
  if (!command || command === 'all') {
    // Collect everything
    await collector.collectAllStats();
  } else if (['traditional', 'statcast', 'sabermetrics'].includes(command)) {
    // Collect specific category
    await collector.collectSpecificCategory(command as any);
  } else {
    console.log('📖 Usage:');
    console.log('  npx tsx next-gen-mlb-collector.ts [command]');
    console.log('\nCommands:');
    console.log('  all          - Collect all statistics (default)');
    console.log('  traditional  - Collect only traditional stats');
    console.log('  statcast     - Collect only Statcast metrics');
    console.log('  sabermetrics - Collect only advanced sabermetrics');
    console.log('\nExample:');
    console.log('  npx tsx next-gen-mlb-collector.ts statcast');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { NextGenMLBCollector };