import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport') || 'all'
    const sortBy = searchParams.get('sortBy') || 'accuracy'
    const search = searchParams.get('search') || ''

    // Fetch from Pattern Gateway
    try {
      const response = await fetch('http://localhost:3000/api/patterns/all', {
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Transform database patterns to frontend format
        const patterns = data.patterns.map((p: any, index: number) => ({
          id: p.id || `pattern-${index + 1}`,
          name: p.pattern_type || p.name,
          description: p.description || `Pattern with ${(p.accuracy_rate * 100).toFixed(1)}% accuracy`,
          accuracy: p.accuracy_rate * 100,
          roi: p.roi * 100,
          occurrences: p.total_occurrences || 0,
          confidence: p.accuracy_rate > 0.7 ? 'high' : p.accuracy_rate > 0.6 ? 'medium' : 'low',
          sport: p.sport || 'all',
          lastTriggered: p.last_updated || new Date().toISOString(),
          profitPotential: parseFloat(p.total_profit_loss || '0'),
        }))

        // Apply filters
        let filtered = sport === 'all' 
          ? patterns 
          : patterns.filter((p: any) => p.sport === sport || p.sport === 'all')

        if (search) {
          filtered = filtered.filter((p: any) => 
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
          )
        }

        // Sort
        filtered.sort((a: any, b: any) => {
          switch (sortBy) {
            case 'accuracy':
              return b.accuracy - a.accuracy
            case 'roi':
              return b.roi - a.roi
            case 'occurrences':
              return b.occurrences - a.occurrences
            case 'recent':
              return new Date(b.lastTriggered).getTime() - new Date(a.lastTriggered).getTime()
            default:
              return 0
          }
        })

        // Use stats from the gateway response or calculate our own
        const stats = data.stats || {
          totalPatterns: filtered.length,
          averageAccuracy: filtered.reduce((sum: number, p: any) => sum + p.accuracy, 0) / filtered.length || 0,
          totalProfit: filtered.reduce((sum: number, p: any) => sum + p.profitPotential, 0),
          totalOccurrences: filtered.reduce((sum: number, p: any) => sum + p.occurrences, 0),
        }

        return NextResponse.json({
          patterns: filtered,
          stats: {
            totalPatterns: stats.totalPatterns,
            avgAccuracy: parseFloat(stats.averageAccuracy) || stats.avgAccuracy,
            totalProfit: parseFloat(stats.totalProfit),
            totalOccurrences: stats.totalOccurrences,
          }
        })
      }
    } catch (error) {
      console.log('Pattern Gateway not available:', error)
    }

    // Return empty array if gateway not available
    return NextResponse.json({
      patterns: [],
      stats: {
        totalPatterns: 0,
        avgAccuracy: 0,
        totalProfit: 0,
        totalOccurrences: 0,
      }
    })
  } catch (error) {
    console.error('Error fetching patterns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patterns' },
      { status: 500 }
    )
  }
}