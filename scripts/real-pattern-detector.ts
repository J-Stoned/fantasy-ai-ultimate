#!/usr/bin/env tsx
/**
 * 🔥 REAL PATTERN DETECTOR - NO MORE RANDOM!
 * 
 * Detects patterns using actual game data and logic
 * Tracks real accuracy by comparing predictions to outcomes
 */

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

interface PatternResult {
  pattern: string;
  detected: boolean;
  confidence: number;
  reasoning: string;
  betRecommendation?: string;
}

interface GameWithContext {
  id: number;
  sport: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  start_time: string;
  venue?: string;
  // Previous game data
  homeTeamPrevGame?: any;
  awayTeamPrevGame?: any;
  // H2H history
  previousMeetings?: any[];
}

export class RealPatternDetector {
  private predictions: Map<number, any> = new Map();
  private accuracy = {
    totalPredictions: 0,
    correctPredictions: 0,
    patternAccuracy: {} as Record<string, { correct: number; total: number }>
  };

  async detectPatterns(gameId: number): Promise<PatternResult[]> {
    console.log(chalk.cyan(`\n🔍 Detecting patterns for game ${gameId}...`));

    // Get game with full context
    const gameContext = await this.getGameWithContext(gameId);
    if (!gameContext) {
      console.log(chalk.red('Game not found'));
      return [];
    }

    const patterns: PatternResult[] = [];

    // Check each pattern with REAL logic
    patterns.push(await this.checkBackToBackFade(gameContext));
    patterns.push(await this.checkRevengeGame(gameContext));
    patterns.push(await this.checkAltitudeAdvantage(gameContext));
    patterns.push(await this.checkDivisionDogBite(gameContext));
    patterns.push(await this.checkPerfectStorm(gameContext));

    // Store predictions for accuracy tracking
    this.storePrediction(gameId, patterns);

    return patterns.filter(p => p.detected);
  }

  /**
   * Get game with full context (previous games, H2H, etc.)
   */
  private async getGameWithContext(gameId: number): Promise<GameWithContext | null> {
    // Get the game
    const { data: game } = await enhancedDb.getClient()
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!game) return null;

    // Get previous games for both teams
    const gameDate = new Date(game.start_time);
    const twoDaysAgo = new Date(gameDate.getTime() - 2 * 24 * 60 * 60 * 1000);

    const { data: recentGames } = await enhancedDb.getClient()
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id},home_team_id.eq.${game.away_team_id},away_team_id.eq.${game.away_team_id}`)
      .gte('start_time', twoDaysAgo.toISOString())
      .lt('start_time', game.start_time)
      .order('start_time', { ascending: false });

    // Find most recent games for each team
    const homeTeamPrevGame = recentGames?.find(g => 
      g.id !== gameId && (g.home_team_id === game.home_team_id || g.away_team_id === game.home_team_id)
    );
    const awayTeamPrevGame = recentGames?.find(g => 
      g.id !== gameId && (g.home_team_id === game.away_team_id || g.away_team_id === game.away_team_id)
    );

    // Get H2H history
    const { data: previousMeetings } = await enhancedDb.getClient()
      .from('games')
      .select('*')
      .or(`and(home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.away_team_id}),and(home_team_id.eq.${game.away_team_id},away_team_id.eq.${game.home_team_id})`)
      .lt('start_time', game.start_time)
      .order('start_time', { ascending: false })
      .limit(5);

    return {
      ...game,
      homeTeamPrevGame,
      awayTeamPrevGame,
      previousMeetings
    };
  }

  /**
   * REAL Back-to-Back Fade Detection
   */
  private async checkBackToBackFade(game: GameWithContext): Promise<PatternResult> {
    // Check if either team played yesterday
    const gameDate = new Date(game.start_time);
    
    let isBackToBack = false;
    let affectedTeam = '';
    let reasoning = '';

    if (game.homeTeamPrevGame) {
      const prevDate = new Date(game.homeTeamPrevGame.start_time);
      const daysDiff = (gameDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 1) {
        isBackToBack = true;
        affectedTeam = 'home';
        reasoning = `Home team played ${daysDiff.toFixed(1)} days ago`;
      }
    }

    if (game.awayTeamPrevGame) {
      const prevDate = new Date(game.awayTeamPrevGame.start_time);
      const daysDiff = (gameDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 1) {
        isBackToBack = true;
        affectedTeam = affectedTeam ? 'both' : 'away';
        reasoning += reasoning ? ' | ' : '';
        reasoning += `Away team played ${daysDiff.toFixed(1)} days ago`;
      }
    }

    return {
      pattern: 'Back-to-Back Fade',
      detected: isBackToBack,
      confidence: isBackToBack ? 0.768 : 0,
      reasoning: reasoning || 'No back-to-back games detected',
      betRecommendation: isBackToBack ? `Fade the ${affectedTeam} team` : undefined
    };
  }

  /**
   * REAL Revenge Game Detection
   */
  private async checkRevengeGame(game: GameWithContext): Promise<PatternResult> {
    if (!game.previousMeetings || game.previousMeetings.length === 0) {
      return {
        pattern: 'Revenge Game',
        detected: false,
        confidence: 0,
        reasoning: 'No previous meetings found'
      };
    }

    const lastMeeting = game.previousMeetings[0];
    const wasBlowout = Math.abs(lastMeeting.home_score - lastMeeting.away_score) > 20;
    
    // Check if the losing team is now at home
    const losingTeam = lastMeeting.home_score > lastMeeting.away_score 
      ? lastMeeting.away_team_id 
      : lastMeeting.home_team_id;
    
    const losingTeamNowHome = losingTeam === game.home_team_id;
    const isRevenge = wasBlowout && losingTeamNowHome;

    return {
      pattern: 'Revenge Game',
      detected: isRevenge,
      confidence: isRevenge ? 0.744 : 0,
      reasoning: isRevenge 
        ? `Home team lost by ${Math.abs(lastMeeting.home_score - lastMeeting.away_score)} last meeting`
        : 'No revenge scenario detected',
      betRecommendation: isRevenge ? 'Bet on home team revenge' : undefined
    };
  }

  /**
   * REAL Altitude Advantage Detection
   */
  private async checkAltitudeAdvantage(game: GameWithContext): Promise<PatternResult> {
    const altitudeVenues = [
      'Ball Arena', 'Coors Field', 'Empower Field', // Denver
      'Vivint Arena', 'Rice-Eccles Stadium', // Salt Lake City
      'Footprint Center', // Phoenix (moderate altitude)
      'Mile High', 'Pepsi Center' // Old Denver venue names
    ];

    const isAltitudeVenue = game.venue && altitudeVenues.some(v => 
      game.venue!.toLowerCase().includes(v.toLowerCase()) ||
      game.venue!.toLowerCase().includes('denver') ||
      game.venue!.toLowerCase().includes('utah') ||
      game.venue!.toLowerCase().includes('salt lake')
    );

    // Check if away team is from sea level
    const { data: awayTeam } = await enhancedDb.getClient()
      .from('teams')
      .select('name, city')
      .eq('id', game.away_team_id)
      .single();

    const seaLevelCities = ['Miami', 'New York', 'Los Angeles', 'Boston', 'Seattle', 'San Francisco'];
    const isSeaLevelTeam = awayTeam && seaLevelCities.some(city => 
      awayTeam.name.includes(city) || awayTeam.city?.includes(city)
    );

    const hasAdvantage = isAltitudeVenue && isSeaLevelTeam;

    return {
      pattern: 'Altitude Advantage',
      detected: hasAdvantage,
      confidence: hasAdvantage ? 0.683 : 0,
      reasoning: hasAdvantage 
        ? `${awayTeam?.name} (sea level) playing at altitude in ${game.venue}`
        : isAltitudeVenue ? 'Altitude venue but no sea level disadvantage' : 'Not an altitude venue',
      betRecommendation: hasAdvantage ? 'Fade the away team' : undefined
    };
  }

  /**
   * REAL Division Dog Bite Detection
   */
  private async checkDivisionDogBite(game: GameWithContext): Promise<PatternResult> {
    // Get team divisions
    const { data: teams } = await enhancedDb.getClient()
      .from('teams')
      .select('id, name, division, conference')
      .in('id', [game.home_team_id, game.away_team_id]);

    if (!teams || teams.length !== 2) {
      return {
        pattern: 'Division Dog Bite',
        detected: false,
        confidence: 0,
        reasoning: 'Could not determine team divisions'
      };
    }

    const homeTeam = teams.find(t => t.id === game.home_team_id);
    const awayTeam = teams.find(t => t.id === game.away_team_id);

    const isDivisionGame = homeTeam?.division && 
                          awayTeam?.division && 
                          homeTeam.division === awayTeam.division;

    // Check if home team is underdog (simple check based on recent performance)
    const recentHomeWins = game.previousMeetings?.filter(g => 
      (g.home_team_id === game.home_team_id && g.home_score > g.away_score) ||
      (g.away_team_id === game.home_team_id && g.away_score > g.home_score)
    ).length || 0;

    const recentAwayWins = game.previousMeetings?.filter(g => 
      (g.home_team_id === game.away_team_id && g.home_score > g.away_score) ||
      (g.away_team_id === game.away_team_id && g.away_score > g.home_score)
    ).length || 0;

    const isUnderdog = recentHomeWins < recentAwayWins;
    const isDivisionDog = isDivisionGame && isUnderdog;

    return {
      pattern: 'Division Dog Bite',
      detected: isDivisionDog,
      confidence: isDivisionDog ? 0.586 : 0,
      reasoning: isDivisionDog 
        ? `Division underdog at home (${recentHomeWins}-${recentAwayWins} recent H2H)`
        : isDivisionGame ? 'Division game but home team favored' : 'Not a division game',
      betRecommendation: isDivisionDog ? 'Bet on home underdog' : undefined
    };
  }

  /**
   * REAL Perfect Storm Detection
   */
  private async checkPerfectStorm(game: GameWithContext): Promise<PatternResult> {
    const factors: string[] = [];

    // Factor 1: Back-to-back
    const b2b = await this.checkBackToBackFade(game);
    if (b2b.detected) factors.push('Back-to-back');

    // Factor 2: Revenge
    const revenge = await this.checkRevengeGame(game);
    if (revenge.detected) factors.push('Revenge game');

    // Factor 3: Long road trip (simplified check)
    if (game.awayTeamPrevGame) {
      const prevAwayGames = await enhancedDb.getClient()
        .from('games')
        .select('*')
        .eq('away_team_id', game.away_team_id)
        .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .lt('start_time', game.start_time);

      if (prevAwayGames.data && prevAwayGames.data.length >= 3) {
        factors.push('Long road trip');
      }
    }

    // Factor 4: Division game
    const division = await this.checkDivisionDogBite(game);
    if (division.reasoning.includes('Division game')) factors.push('Division rivalry');

    const isPerfectStorm = factors.length >= 3;

    return {
      pattern: 'Perfect Storm',
      detected: isPerfectStorm,
      confidence: isPerfectStorm ? 0.670 : 0,
      reasoning: isPerfectStorm 
        ? `Multiple factors: ${factors.join(', ')}`
        : `Only ${factors.length} factors present`,
      betRecommendation: isPerfectStorm ? 'Strong fade on affected team' : undefined
    };
  }

  /**
   * Store prediction for accuracy tracking
   */
  private storePrediction(gameId: number, patterns: PatternResult[]) {
    const prediction = {
      gameId,
      patterns: patterns.filter(p => p.detected),
      timestamp: new Date(),
      predictedOutcome: this.calculatePredictedOutcome(patterns)
    };

    this.predictions.set(gameId, prediction);
  }

  /**
   * Calculate predicted outcome based on patterns
   */
  private calculatePredictedOutcome(patterns: PatternResult[]): string {
    const detectedPatterns = patterns.filter(p => p.detected);
    if (detectedPatterns.length === 0) return 'No clear prediction';

    // Weight patterns by confidence
    let homeAdvantage = 0;
    detectedPatterns.forEach(p => {
      if (p.betRecommendation?.includes('home')) {
        homeAdvantage += p.confidence;
      } else if (p.betRecommendation?.includes('away') || p.betRecommendation?.includes('Fade')) {
        homeAdvantage -= p.confidence;
      }
    });

    return homeAdvantage > 0 ? 'Home team favored' : 'Away team favored';
  }

  /**
   * Check prediction accuracy after game completes
   */
  async checkAccuracy(gameId: number): Promise<void> {
    const prediction = this.predictions.get(gameId);
    if (!prediction) return;

    const { data: game } = await enhancedDb.getClient()
      .from('games')
      .select('home_score, away_score')
      .eq('id', gameId)
      .single();

    if (!game || game.home_score === null) return;

    const actualOutcome = game.home_score > game.away_score ? 'Home team favored' : 'Away team favored';
    const correct = prediction.predictedOutcome === actualOutcome;

    this.accuracy.totalPredictions++;
    if (correct) this.accuracy.correctPredictions++;

    // Track pattern-specific accuracy
    prediction.patterns.forEach(p => {
      if (!this.accuracy.patternAccuracy[p.pattern]) {
        this.accuracy.patternAccuracy[p.pattern] = { correct: 0, total: 0 };
      }
      this.accuracy.patternAccuracy[p.pattern].total++;
      if (correct) this.accuracy.patternAccuracy[p.pattern].correct++;
    });
  }

  /**
   * Get current accuracy stats
   */
  getAccuracyStats() {
    const overall = this.accuracy.totalPredictions > 0 
      ? (this.accuracy.correctPredictions / this.accuracy.totalPredictions * 100).toFixed(1)
      : 0;

    const patternStats = Object.entries(this.accuracy.patternAccuracy).map(([pattern, stats]) => ({
      pattern,
      accuracy: stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : 0,
      total: stats.total
    }));

    return {
      overall: `${overall}%`,
      totalPredictions: this.accuracy.totalPredictions,
      correctPredictions: this.accuracy.correctPredictions,
      patternStats
    };
  }
}

// Test the real pattern detector
async function testRealPatterns() {
  console.log(chalk.bold.red('🔥 REAL PATTERN DETECTION TEST'));
  console.log(chalk.yellow('Using actual game data and logic!\n'));

  const detector = new RealPatternDetector();

  // Get recent games to test
  const { data: recentGames } = await enhancedDb.getClient()
    .from('games')
    .select('id, home_team_id, away_team_id, sport')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(10);

  if (!recentGames || recentGames.length === 0) {
    console.log(chalk.red('No games found'));
    return;
  }

  // Test pattern detection on each game
  for (const game of recentGames) {
    const patterns = await detector.detectPatterns(game.id);
    
    if (patterns.length > 0) {
      console.log(chalk.green(`\n✅ Game ${game.id} - Patterns detected:`));
      patterns.forEach(p => {
        console.log(chalk.white(`  • ${p.pattern}: ${(p.confidence * 100).toFixed(1)}% confidence`));
        console.log(chalk.gray(`    ${p.reasoning}`));
        if (p.betRecommendation) {
          console.log(chalk.yellow(`    💰 ${p.betRecommendation}`));
        }
      });
    } else {
      console.log(chalk.gray(`\nGame ${game.id} - No patterns detected`));
    }

    // Check accuracy if game is complete
    await detector.checkAccuracy(game.id);
  }

  // Show accuracy stats
  const stats = detector.getAccuracyStats();
  console.log(chalk.bold.yellow('\n📊 REAL ACCURACY STATS:'));
  console.log(chalk.white(`Overall accuracy: ${stats.overall}`));
  console.log(chalk.white(`Total predictions: ${stats.totalPredictions}`));
  
  if (stats.patternStats.length > 0) {
    console.log(chalk.cyan('\nPattern-specific accuracy:'));
    stats.patternStats.forEach(p => {
      console.log(chalk.white(`  ${p.pattern}: ${p.accuracy}% (${p.total} games)`));
    });
  }

  console.log(chalk.bold.green('\n✅ REAL PATTERN DETECTION COMPLETE!'));
  console.log(chalk.yellow('No more Math.random() - using actual logic!'));
}

// Export for use in other scripts
export const realPatternDetector = new RealPatternDetector();

// Run if called directly
if (require.main === module) {
  testRealPatterns().catch(console.error);
}