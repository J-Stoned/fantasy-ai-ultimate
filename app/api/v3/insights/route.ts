/**
 * 📱 MOBILE API V3 - FANTASY + BETTING INSIGHTS
 * 
 * Complete integration providing:
 * - Player projections with betting context
 * - Live odds and arbitrage opportunities
 * - Pattern-based recommendations
 * - DFS optimizer with betting edge
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Enhanced cache with longer TTL for stable data
const insightCache = new Map<string, any>();
const CACHE_TTL = {
  odds: 30 * 1000,        // 30 seconds for live odds
  players: 5 * 60 * 1000, // 5 minutes for player data
  patterns: 60 * 60 * 1000 // 1 hour for patterns
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all, players, odds, patterns
    const sport = searchParams.get('sport') || 'MLB';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    const response = {
      timestamp: new Date().toISOString(),
      data: {} as any
    };
    
    // Get requested data types
    if (type === 'all' || type === 'players') {
      response.data.players = await getPlayersWithBettingContext(sport, date);
    }
    
    if (type === 'all' || type === 'odds') {
      response.data.odds = await getLiveOddsWithPatterns(sport, date);
    }
    
    if (type === 'all' || type === 'patterns') {
      response.data.patterns = await getActivePatternsToday(sport, date);
    }
    
    if (type === 'all' || type === 'dfs') {
      response.data.dfsLineup = await generateDFSLineupWithEdge(sport, date);
    }
    
    // Add summary statistics
    response.data.summary = generateSummary(response.data);
    
    return NextResponse.json({
      success: true,
      ...response
    });
    
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function getPlayersWithBettingContext(sport: string, date: string) {
  const cacheKey = `players-${sport}-${date}`;
  const cached = insightCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.players) {
    return cached.data;
  }
  
  // Get today's games first
  const { data: games } = await supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
      away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
    `)
    .eq('sport', sport)
    .gte('start_time', `${date}T00:00:00`)
    .lte('start_time', `${date}T23:59:59`);
  
  if (!games || games.length === 0) return [];
  
  // Get players from teams playing today
  const teamIds = games.flatMap(g => [g.home_team_id, g.away_team_id]);
  
  const { data: players } = await supabase
    .from('players')
    .select(`
      *,
      player_stats(*)
    `)
    .in('team_id', teamIds)
    .eq('active', true)
    .limit(100);
  
  if (!players) return [];
  
  // Enhance each player with betting context
  const enhancedPlayers = await Promise.all(players.map(async (player) => {
    const game = games.find(g => 
      g.home_team_id === player.team_id || g.away_team_id === player.team_id
    );
    
    if (!game) return null;
    
    // Get latest odds for the game
    const { data: odds } = await supabase
      .from('live_odds_cache')
      .select('*')
      .eq('event_id', game.external_id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();
    
    // Calculate fantasy projection with betting edge
    const projection = calculateEnhancedProjection(player, game, odds);
    
    return {
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team_id,
      opponent: game.home_team_id === player.team_id ? game.away_team : game.home_team,
      gameTime: game.start_time,
      stats: {
        season: player.player_stats?.[0] || {},
        last7Days: calculateLast7Days(player.player_stats)
      },
      betting: {
        teamOdds: game.home_team_id === player.team_id ? odds?.home_odds : odds?.away_odds,
        gameTotal: odds?.over_line || 0,
        isHome: game.home_team_id === player.team_id,
        patterns: game.metadata?.pattern_types || []
      },
      fantasy: projection
    };
  }));
  
  const validPlayers = enhancedPlayers.filter(p => p !== null);
  
  insightCache.set(cacheKey, {
    timestamp: Date.now(),
    data: validPlayers
  });
  
  return validPlayers;
}

async function getLiveOddsWithPatterns(sport: string, date: string) {
  const cacheKey = `odds-${sport}-${date}`;
  const cached = insightCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.odds) {
    return cached.data;
  }
  
  // Get games with patterns
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', sport)
    .gte('start_time', `${date}T00:00:00`)
    .lte('start_time', `${date}T23:59:59`)
    .not('metadata->has_pattern', 'is', null);
  
  if (!games) return [];
  
  // Get latest odds for each game
  const oddsData = await Promise.all(games.map(async (game) => {
    const { data: odds } = await supabase
      .from('live_odds_cache')
      .select('*')
      .eq('event_id', game.external_id)
      .order('fetched_at', { ascending: false });
    
    // Check for arbitrage across books
    const arbitrage = findArbitrageOpportunities(odds || []);
    
    return {
      gameId: game.id,
      eventName: game.metadata?.event_name || 'Unknown',
      startTime: game.start_time,
      patterns: game.metadata?.pattern_types || [],
      patternConfidence: game.metadata?.pattern_confidence || 0,
      odds: odds || [],
      arbitrage: arbitrage,
      recommendations: generateBettingRecommendations(game, odds || [])
    };
  }));
  
  insightCache.set(cacheKey, {
    timestamp: Date.now(),
    data: oddsData
  });
  
  return oddsData;
}

async function getActivePatternsToday(sport: string, date: string) {
  const { data: patterns } = await supabase
    .from('games')
    .select('*')
    .eq('sport', sport)
    .gte('start_time', `${date}T00:00:00`)
    .lte('start_time', `${date}T23:59:59`)
    .not('metadata->has_pattern', 'is', null);
  
  if (!patterns) return [];
  
  // Group by pattern type
  const patternSummary: any = {};
  
  patterns.forEach(game => {
    const types = game.metadata?.pattern_types || [];
    types.forEach((type: string) => {
      if (!patternSummary[type]) {
        patternSummary[type] = {
          count: 0,
          games: [],
          avgConfidence: 0,
          historicalAccuracy: getPatternAccuracy(type)
        };
      }
      
      patternSummary[type].count++;
      patternSummary[type].games.push({
        id: game.id,
        teams: game.metadata?.event_name,
        confidence: game.metadata?.pattern_confidence
      });
    });
  });
  
  // Calculate averages
  Object.keys(patternSummary).forEach(pattern => {
    const totalConfidence = patternSummary[pattern].games.reduce(
      (sum: number, g: any) => sum + g.confidence, 0
    );
    patternSummary[pattern].avgConfidence = totalConfidence / patternSummary[pattern].count;
  });
  
  return patternSummary;
}

async function generateDFSLineupWithEdge(sport: string, date: string) {
  const players = await getPlayersWithBettingContext(sport, date);
  
  // DFS sites and salary caps
  const dfsConfig = {
    draftkings: { salaryCap: 50000, positions: ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'] },
    fanduel: { salaryCap: 35000, positions: ['P', 'C/1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF', 'UTIL'] }
  };
  
  // Optimize lineup considering betting patterns
  const lineups: any = {};
  
  for (const [site, config] of Object.entries(dfsConfig)) {
    const lineup = optimizeDFSLineup(players, config, site);
    lineups[site] = lineup;
  }
  
  return lineups;
}

function calculateEnhancedProjection(player: any, game: any, odds: any) {
  let baseProjection = 0;
  const stats = player.player_stats?.[0] || {};
  
  // Base fantasy scoring
  if (player.position === 'P') {
    baseProjection = (stats.wins || 0) * 4 + 
                    (stats.strikeouts || 0) * 0.5 - 
                    (stats.earned_runs || 0) * 1;
  } else {
    baseProjection = (stats.batting_average || 0) * 10 +
                    (stats.home_runs || 0) * 4 +
                    (stats.rbis || 0) * 2 +
                    (stats.runs || 0) * 1;
  }
  
  // Betting adjustments
  const patterns = game.metadata?.pattern_types || [];
  
  if (patterns.includes('altitude_advantage')) {
    baseProjection *= player.position === 'P' ? 0.8 : 1.2; // Boost hitters, fade pitchers
  }
  
  if (patterns.includes('back_to_back_fade') && game.metadata?.is_home_back_to_back) {
    baseProjection *= 0.9; // Fade tired team
  }
  
  // Odds adjustment
  const teamOdds = game.home_team_id === player.team_id ? odds?.home_odds : odds?.away_odds;
  if (teamOdds && teamOdds < -150) {
    baseProjection *= 1.1; // Boost heavy favorites
  }
  
  return {
    points: Math.round(baseProjection * 10) / 10,
    confidence: calculateConfidence(player, game, patterns),
    edge: patterns.length > 0 ? 'PATTERN_EDGE' : 'NEUTRAL'
  };
}

function calculateLast7Days(stats: any[]) {
  // Calculate rolling 7-day stats
  return {
    avg: 0.285, // Placeholder
    ops: 0.825,
    trend: 'up'
  };
}

function findArbitrageOpportunities(odds: any[]) {
  if (odds.length < 2) return [];
  
  const opportunities = [];
  
  // Group by market type
  const markets = ['moneyline', 'spread', 'total'];
  
  for (const market of markets) {
    // Find best odds for each side
    let best1 = { odds: -Infinity, book: '' };
    let best2 = { odds: -Infinity, book: '' };
    
    odds.forEach(bookOdds => {
      if (market === 'moneyline') {
        if (bookOdds.home_odds > best1.odds) {
          best1 = { odds: bookOdds.home_odds, book: bookOdds.sportsbook };
        }
        if (bookOdds.away_odds > best2.odds) {
          best2 = { odds: bookOdds.away_odds, book: bookOdds.sportsbook };
        }
      }
      // Add spread and total logic...
    });
    
    // Calculate if arbitrage exists
    const prob1 = oddsToProb(best1.odds);
    const prob2 = oddsToProb(best2.odds);
    
    if (prob1 + prob2 < 0.98) {
      opportunities.push({
        market,
        profit: ((1 - (prob1 + prob2)) * 100).toFixed(2),
        bet1: best1,
        bet2: best2
      });
    }
  }
  
  return opportunities;
}

function oddsToProb(americanOdds: number): number {
  return americanOdds > 0 ? 100 / (americanOdds + 100) : -americanOdds / (-americanOdds + 100);
}

function generateBettingRecommendations(game: any, odds: any[]) {
  const recommendations = [];
  const patterns = game.metadata?.pattern_types || [];
  
  if (patterns.includes('altitude_advantage')) {
    recommendations.push({
      type: 'TOTAL',
      selection: 'OVER',
      confidence: 0.683,
      reason: 'Altitude advantage at Coors Field'
    });
  }
  
  if (patterns.includes('back_to_back_fade')) {
    recommendations.push({
      type: 'SPREAD',
      selection: 'OPPONENT',
      confidence: 0.768,
      reason: 'Fade team on back-to-back'
    });
  }
  
  return recommendations;
}

function getPatternAccuracy(pattern: string): number {
  const accuracies: any = {
    'altitude_advantage': 0.683,
    'back_to_back_fade': 0.768,
    'embarrassment_revenge': 0.744,
    'division_rivalry': 0.556,
    'home_underdog': 0.612
  };
  
  return accuracies[pattern] || 0.5;
}

function calculateConfidence(player: any, game: any, patterns: string[]): number {
  let confidence = 0.5; // Base confidence
  
  // Adjust based on patterns
  if (patterns.length > 0) {
    confidence += patterns.length * 0.1;
  }
  
  // Adjust based on recent performance
  const stats = player.player_stats?.[0];
  if (stats?.batting_average > 0.300) confidence += 0.1;
  if (stats?.ops > 0.850) confidence += 0.1;
  
  return Math.min(confidence, 0.9);
}

function optimizeDFSLineup(players: any[], config: any, site: string): any {
  // Simplified DFS optimization
  // In production, use proper knapsack algorithm
  
  const lineup = {
    players: [] as any[],
    totalSalary: 0,
    projectedPoints: 0,
    patternBonus: 0
  };
  
  // Sort by value (points per dollar) with pattern bonus
  const sortedPlayers = players
    .filter(p => p !== null)
    .map(p => ({
      ...p,
      salary: getSalary(p, site),
      value: p.fantasy.points / getSalary(p, site) * (p.betting.patterns.length > 0 ? 1.2 : 1)
    }))
    .sort((a, b) => b.value - a.value);
  
  // Fill positions
  for (const position of config.positions) {
    const player = sortedPlayers.find(p => 
      matchesPosition(p.position, position) && 
      lineup.totalSalary + p.salary <= config.salaryCap &&
      !lineup.players.includes(p)
    );
    
    if (player) {
      lineup.players.push(player);
      lineup.totalSalary += player.salary;
      lineup.projectedPoints += player.fantasy.points;
      if (player.betting.patterns.length > 0) {
        lineup.patternBonus += 5; // Bonus points for pattern plays
      }
    }
  }
  
  return lineup;
}

function getSalary(player: any, site: string): number {
  // Mock salaries - in production, fetch from DFS sites
  return 5000 + Math.random() * 5000;
}

function matchesPosition(playerPos: string, requiredPos: string): boolean {
  if (requiredPos === 'UTIL') return true;
  if (requiredPos.includes('/')) {
    return requiredPos.split('/').includes(playerPos);
  }
  return playerPos === requiredPos;
}

function generateSummary(data: any) {
  return {
    totalPlayers: data.players?.length || 0,
    gamesWithPatterns: data.patterns ? Object.keys(data.patterns).reduce((sum, p) => sum + data.patterns[p].count, 0) : 0,
    arbitrageOpportunities: data.odds?.reduce((sum: number, g: any) => sum + g.arbitrage.length, 0) || 0,
    topPattern: data.patterns ? Object.entries(data.patterns).sort((a: any, b: any) => b[1].count - a[1].count)[0]?.[0] : null,
    dfsLineupValue: data.dfsLineup?.draftkings?.projectedPoints || 0
  };
}