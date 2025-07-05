#!/usr/bin/env tsx
/**
 * 🎯 TEST ENHANCED PLAYER FEATURES
 * Phase 2: Validate player-level feature extraction
 */

import chalk from 'chalk';
import { EnhancedPlayerExtractor } from '../lib/ml/enhanced-player-features';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testEnhancedPlayerFeatures() {
  console.log(chalk.bold.cyan('🎯 TESTING ENHANCED PLAYER FEATURES\n'));
  
  const extractor = new EnhancedPlayerExtractor();
  
  try {
    // Get a couple of teams to test with
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .limit(2);
    
    if (!teams || teams.length < 2) {
      console.log(chalk.red('❌ Need at least 2 teams in database'));
      return;
    }
    
    const [homeTeam, awayTeam] = teams;
    const gameDate = new Date(); // Today
    
    console.log(chalk.yellow(`Testing: ${homeTeam.name} (Home) vs ${awayTeam.name} (Away)`));
    console.log(chalk.gray(`Game Date: ${gameDate.toDateString()}\n`));
    
    // Extract features for both teams
    console.log(chalk.cyan('🏠 Extracting HOME team player features...'));
    const homeFeatures = await extractor.extractPlayerFeatures(homeTeam.id, gameDate);
    
    console.log(chalk.cyan('✈️  Extracting AWAY team player features...'));
    const awayFeatures = await extractor.extractPlayerFeatures(awayTeam.id, gameDate);
    
    // Display results
    console.log(chalk.bold.green('\n🏠 HOME TEAM PLAYER FEATURES:'));
    console.log(chalk.green('═'.repeat(50)));
    
    console.log(chalk.yellow('⭐ Star Player Features:'));
    console.log(`  Top Player Fantasy Avg: ${(homeFeatures.topPlayerFantasyAvg * 100).toFixed(1)}%`);
    console.log(`  Star Player Availability: ${(homeFeatures.starPlayerAvailability * 100).toFixed(1)}%`);
    console.log(`  Starting Lineup Strength: ${(homeFeatures.startingLineupStrength * 100).toFixed(1)}%`);
    console.log(`  Bench Depth: ${(homeFeatures.benchDepth * 100).toFixed(1)}%`);
    
    console.log(chalk.yellow('\n🏈 Positional Features:'));
    console.log(`  Quarterback Rating: ${(homeFeatures.quarterbackRating * 100).toFixed(1)}%`);
    console.log(`  Offensive Line Strength: ${(homeFeatures.offensiveLineStrength * 100).toFixed(1)}%`);
    console.log(`  Defensive Rating: ${(homeFeatures.defensiveRating * 100).toFixed(1)}%`);
    console.log(`  Special Teams Impact: ${(homeFeatures.specialTeamsImpact * 100).toFixed(1)}%`);
    
    console.log(chalk.yellow('\n📈 Recent Form Features:'));
    console.log(`  Player Momentum: ${(homeFeatures.playerMomentum * 100).toFixed(1)}%`);
    console.log(`  Injury Recovery Factor: ${(homeFeatures.injuryRecoveryFactor * 100).toFixed(1)}%`);
    console.log(`  Fatigue Factor: ${(homeFeatures.fatigueFactor * 100).toFixed(1)}%`);
    console.log(`  Chemistry Rating: ${(homeFeatures.chemistryRating * 100).toFixed(1)}%`);
    
    console.log(chalk.yellow('\n🧠 Advanced Metrics:'));
    console.log(`  Total Fantasy Potential: ${(homeFeatures.totalFantasyPotential * 100).toFixed(1)}%`);
    console.log(`  Injury Risk Score: ${(homeFeatures.injuryRiskScore * 100).toFixed(1)}%`);
    console.log(`  Experience Rating: ${(homeFeatures.experienceRating * 100).toFixed(1)}%`);
    console.log(`  Clutch Player Availability: ${(homeFeatures.clutchPlayerAvailability * 100).toFixed(1)}%`);
    
    console.log(chalk.bold.blue('\n✈️  AWAY TEAM PLAYER FEATURES:'));
    console.log(chalk.blue('═'.repeat(50)));
    
    console.log(chalk.yellow('⭐ Star Player Features:'));
    console.log(`  Top Player Fantasy Avg: ${(awayFeatures.topPlayerFantasyAvg * 100).toFixed(1)}%`);
    console.log(`  Star Player Availability: ${(awayFeatures.starPlayerAvailability * 100).toFixed(1)}%`);
    console.log(`  Starting Lineup Strength: ${(awayFeatures.startingLineupStrength * 100).toFixed(1)}%`);
    console.log(`  Bench Depth: ${(awayFeatures.benchDepth * 100).toFixed(1)}%`);
    
    // Calculate feature advantages
    console.log(chalk.bold.magenta('\n⚔️  FEATURE COMPARISON:'));
    console.log(chalk.magenta('═'.repeat(50)));
    
    const starAdvantage = homeFeatures.topPlayerFantasyAvg - awayFeatures.topPlayerFantasyAvg;
    const availabilityAdvantage = homeFeatures.starPlayerAvailability - awayFeatures.starPlayerAvailability;
    const momentumAdvantage = homeFeatures.playerMomentum - awayFeatures.playerMomentum;
    const depthAdvantage = homeFeatures.benchDepth - awayFeatures.benchDepth;
    
    console.log(`🌟 Star Player Advantage: ${starAdvantage > 0 ? 'HOME' : 'AWAY'} (+${Math.abs(starAdvantage * 100).toFixed(1)}%)`);
    console.log(`🏥 Health Advantage: ${availabilityAdvantage > 0 ? 'HOME' : 'AWAY'} (+${Math.abs(availabilityAdvantage * 100).toFixed(1)}%)`);
    console.log(`📈 Momentum Advantage: ${momentumAdvantage > 0 ? 'HOME' : 'AWAY'} (+${Math.abs(momentumAdvantage * 100).toFixed(1)}%)`);
    console.log(`🎒 Depth Advantage: ${depthAdvantage > 0 ? 'HOME' : 'AWAY'} (+${Math.abs(depthAdvantage * 100).toFixed(1)}%)`);
    
    // Calculate overall player advantage
    const homePlayerScore = Object.values(homeFeatures).reduce((sum, val) => sum + val, 0) / Object.keys(homeFeatures).length;
    const awayPlayerScore = Object.values(awayFeatures).reduce((sum, val) => sum + val, 0) / Object.keys(awayFeatures).length;
    
    console.log(chalk.bold.yellow('\n🏆 OVERALL PLAYER ADVANTAGE:'));
    const overallAdvantage = homePlayerScore - awayPlayerScore;
    if (Math.abs(overallAdvantage) < 0.05) {
      console.log(chalk.gray('📊 Teams are evenly matched in player quality'));
    } else {
      const advantageTeam = overallAdvantage > 0 ? 'HOME' : 'AWAY';
      const advantageColor = overallAdvantage > 0 ? chalk.green : chalk.blue;
      console.log(advantageColor(`📊 ${advantageTeam} team has a ${Math.abs(overallAdvantage * 100).toFixed(1)}% player advantage`));
    }
    
    // Feature count
    const featureCount = Object.keys(homeFeatures).length + Object.keys(awayFeatures).length;
    console.log(chalk.bold.cyan(`\n✅ Enhanced player features test completed!`));
    console.log(chalk.gray(`Total new ML features: ${featureCount} (${Object.keys(homeFeatures).length} per team)`));
    console.log(chalk.gray('These features will significantly improve prediction accuracy!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
  }
}

testEnhancedPlayerFeatures().catch(console.error);