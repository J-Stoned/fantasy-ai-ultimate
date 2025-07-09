import { NextRequest, NextResponse } from 'next/server';
import { RealPatternAnalyzer } from '@/lib/patterns/RealPatternAnalyzer';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/patterns/analyze
 * Analyze games for betting patterns using REAL data
 */
export async function POST(request: NextRequest) {
  try {
    const { gameIds } = await request.json();
    
    if (!gameIds || !Array.isArray(gameIds)) {
      return NextResponse.json(
        { error: 'gameIds array is required' },
        { status: 400 }
      );
    }

    // Initialize real pattern analyzer
    const analyzer = new RealPatternAnalyzer();
    
    // Analyze each game
    const results = await Promise.all(
      gameIds.map(id => analyzer.analyzeGame(id))
    );
    
    // Calculate summary statistics
    const totalGames = results.length;
    const patternsDetected = results.reduce((sum, r) => 
      sum + r.patterns.filter(p => p.detected).length, 0
    );
    const avgConfidence = results.reduce((sum, r) => 
      sum + r.totalConfidence, 0
    ) / totalGames;
    
    return NextResponse.json({
      success: true,
      results,
      summary: {
        gamesAnalyzed: totalGames,
        patternsDetected,
        avgConfidence: (avgConfidence * 100).toFixed(1) + '%',
        topPatterns: getTopPatterns(results)
      }
    });
    
  } catch (error) {
    console.error('Pattern analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze patterns', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/patterns/analyze
 * Get pattern analysis capabilities
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/patterns/analyze',
    method: 'POST',
    description: 'Analyze games for betting patterns using real data',
    patterns: [
      {
        name: 'Back-to-Back Fade',
        description: 'Teams playing on consecutive nights perform worse',
        factors: ['rest days', 'travel distance', 'game schedule']
      },
      {
        name: 'Embarrassment Revenge',
        description: 'Teams seek revenge after being blown out',
        factors: ['previous margin', 'days since loss', 'venue change']
      },
      {
        name: 'Altitude Advantage',
        description: 'Teams struggle in high altitude venues',
        factors: ['venue altitude', 'acclimatization time', 'travel origin']
      },
      {
        name: 'Perfect Storm',
        description: 'Multiple negative factors align',
        factors: ['combined patterns', 'compound effects']
      },
      {
        name: 'Division Dog Bite',
        description: 'Division underdogs perform better than expected',
        factors: ['division rivalry', 'recent records', 'underdog status']
      }
    ],
    usage: {
      request: {
        gameIds: '[1, 2, 3] // Array of game IDs to analyze'
      },
      response: {
        results: 'Array of game analyses with detected patterns',
        summary: 'Aggregate statistics across all games'
      }
    }
  });
}

function getTopPatterns(results: any[]) {
  const patternCounts: Record<string, number> = {};
  
  results.forEach(result => {
    result.patterns.forEach((pattern: any) => {
      if (pattern.detected) {
        patternCounts[pattern.type] = (patternCounts[pattern.type] || 0) + 1;
      }
    });
  });
  
  return Object.entries(patternCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([pattern, count]) => ({ pattern, count }));
}