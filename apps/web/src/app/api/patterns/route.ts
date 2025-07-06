import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport') || 'all'
    const sortBy = searchParams.get('sortBy') || 'accuracy'
    const search = searchParams.get('search') || ''

    // For now, return mock data
    // In production, this would query the actual pattern detection results
    const patterns = [
      {
        id: '1',
        name: 'Back-to-Back Fade',
        description: 'Teams on second game of back-to-back underperform',
        accuracy: 76.8,
        roi: 46.6,
        occurrences: 8234,
        confidence: 'high',
        sport: 'basketball',
        lastTriggered: new Date().toISOString(),
        profitPotential: 8234 * 46.6 * 10,
      },
      {
        id: '2',
        name: 'Embarrassment Revenge',
        description: 'Teams bounce back after 20+ point losses',
        accuracy: 74.4,
        roi: 41.9,
        occurrences: 5421,
        confidence: 'high',
        sport: 'football',
        lastTriggered: new Date().toISOString(),
        profitPotential: 5421 * 41.9 * 10,
      },
      {
        id: '3',
        name: 'Altitude Advantage',
        description: 'Home teams at high altitude dominate',
        accuracy: 68.3,
        roi: 36.3,
        occurrences: 3156,
        confidence: 'medium',
        sport: 'football',
        lastTriggered: new Date().toISOString(),
        profitPotential: 3156 * 36.3 * 10,
      },
      {
        id: '4',
        name: 'Perfect Storm',
        description: 'Multiple factors align for upset potential',
        accuracy: 67.0,
        roi: 35.9,
        occurrences: 2847,
        confidence: 'medium',
        sport: 'all',
        lastTriggered: new Date().toISOString(),
        profitPotential: 2847 * 35.9 * 10,
      },
      {
        id: '5',
        name: 'Division Dog Bite',
        description: 'Division underdogs cover at high rate',
        accuracy: 58.6,
        roi: 32.9,
        occurrences: 9876,
        confidence: 'low',
        sport: 'football',
        lastTriggered: new Date().toISOString(),
        profitPotential: 9876 * 32.9 * 10,
      },
    ]

    // Filter by sport
    let filtered = sport === 'all' 
      ? patterns 
      : patterns.filter(p => p.sport === sport || p.sport === 'all')

    // Filter by search
    if (search) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Sort
    filtered.sort((a, b) => {
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

    // Calculate aggregates
    const totalPatterns = filtered.length
    const avgAccuracy = filtered.reduce((sum, p) => sum + p.accuracy, 0) / totalPatterns || 0
    const totalProfit = filtered.reduce((sum, p) => sum + p.profitPotential, 0)
    const totalOccurrences = filtered.reduce((sum, p) => sum + p.occurrences, 0)

    return NextResponse.json({
      patterns: filtered,
      stats: {
        totalPatterns,
        avgAccuracy,
        totalProfit,
        totalOccurrences,
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