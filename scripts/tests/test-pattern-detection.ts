#!/usr/bin/env tsx

/**
 * Test Real Pattern Detection
 * Verifies pattern detection is using actual data, not Math.random()
 */

import chalk from 'chalk';
import { RealPatternAnalyzer } from '../lib/patterns/RealPatternAnalyzer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPatternDetection() {
  console.log(chalk.blue('🧪 Testing Real Pattern Detection...\n'));

  try {
    // Get some recent games to analyze
    const games = await prisma.game.findMany({
      where: {
        status: 'COMPLETED',
        home_score: { not: null },
        away_score: { not: null }
      },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        home_team: true,
        away_team: true
      }
    });

    if (games.length === 0) {
      console.log(chalk.yellow('⚠️  No completed games found in database'));
      console.log(chalk.yellow('   Run data collection scripts first:'));
      console.log(chalk.yellow('   npm run data:collect'));
      return;
    }

    console.log(chalk.green(`Found ${games.length} games to analyze\n`));

    const analyzer = new RealPatternAnalyzer();

    // Test each game
    for (const game of games) {
      console.log(chalk.cyan(`\n📊 Analyzing: ${game.home_team?.name} vs ${game.away_team?.name}`));
      console.log(`   Date: ${game.date.toLocaleDateString()}`);
      console.log(`   Score: ${game.home_score} - ${game.away_score}`);

      const analysis = await analyzer.analyzeGame(game.id);

      console.log(`\n   🎯 Patterns Detected:`);
      analysis.patterns.forEach(pattern => {
        if (pattern.detected) {
          console.log(chalk.green(`   ✅ ${pattern.type}`));
          console.log(`      Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
          console.log(`      Impact: ${pattern.impact > 0 ? '+' : ''}${pattern.impact.toFixed(1)} points`);
          console.log(`      ${pattern.recommendation}`);
        }
      });

      if (analysis.patterns.filter(p => p.detected).length === 0) {
        console.log(chalk.gray('   No patterns detected'));
      }

      console.log(`\n   📈 Best Play: ${analysis.bestPlay}`);
      console.log(`   🎲 Overall Confidence: ${(analysis.totalConfidence * 100).toFixed(1)}%`);
    }

    // Test consistency (should NOT be random)
    console.log(chalk.blue('\n\n🔄 Testing Consistency (5 runs on same game)...'));
    const testGameId = games[0].id;
    const results = [];

    for (let i = 0; i < 5; i++) {
      const analysis = await analyzer.analyzeGame(testGameId);
      results.push(analysis.totalConfidence);
    }

    const allSame = results.every(r => r === results[0]);
    if (allSame) {
      console.log(chalk.green('✅ Results are consistent - NOT using Math.random()!'));
    } else {
      console.log(chalk.red('❌ Results vary between runs - might be using random values'));
      console.log('   Results:', results);
    }

    // Test API endpoint
    console.log(chalk.blue('\n\n🌐 Testing API Endpoint...'));
    const response = await fetch('http://localhost:3000/api/patterns/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameIds: games.map(g => g.id) })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(chalk.green('✅ API endpoint working!'));
      console.log(`   Games analyzed: ${data.summary.gamesAnalyzed}`);
      console.log(`   Patterns detected: ${data.summary.patternsDetected}`);
      console.log(`   Average confidence: ${data.summary.avgConfidence}`);
    } else {
      console.log(chalk.red('❌ API endpoint failed'));
      console.log('   Make sure the server is running: npm run dev:web');
    }

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPatternDetection()
  .then(() => {
    console.log(chalk.green('\n✅ Pattern detection test complete!'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ Test failed!'), error);
    process.exit(1);
  });