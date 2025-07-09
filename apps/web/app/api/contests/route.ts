import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport') || 'all'
    const type = searchParams.get('type') || 'all'
    
    // Query real contests from database
    let query = supabase
      .from('contests')
      .select('*')
      .eq('status', 'upcoming')
      .order('start_time', { ascending: true })
    
    if (sport !== 'all') {
      query = query.eq('sport', sport)
    }
    
    if (type !== 'all') {
      query = query.eq('type', type)
    }
    
    const { data: contests, error } = await query
    
    if (error) {
      throw error
    }
    
    // If no contests found, return sample data
    if (!contests || contests.length === 0) {
      const sampleContests = [
        {
          id: 'sample-1',
          name: 'NFL Sunday Million',
          type: 'gpp',
          sport: 'nfl',
          entry_fee: 3,
          guaranteed_prize_pool: 1000000,
          max_entries: 350000,
          current_entries: Math.floor(Math.random() * 200000 + 100000),
          start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'upcoming',
          scoring_system: 'ppr',
          salary_cap: 50000,
          roster_requirements: {
            QB: 1,
            RB: 2,
            WR: 3,
            TE: 1,
            FLEX: 1,
            DST: 1
          }
        },
        {
          id: 'sample-2',
          name: 'NBA Sharpshooter',
          type: 'gpp',
          sport: 'nba',
          entry_fee: 5,
          guaranteed_prize_pool: 100000,
          max_entries: 50000,
          current_entries: Math.floor(Math.random() * 30000 + 10000),
          start_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          status: 'upcoming',
          scoring_system: 'standard',
          salary_cap: 50000,
          roster_requirements: {
            PG: 2,
            SG: 2,
            SF: 2,
            PF: 2,
            C: 1
          }
        },
        {
          id: 'sample-3',
          name: 'NFL Double Up',
          type: 'cash',
          sport: 'nfl',
          entry_fee: 25,
          guaranteed_prize_pool: 0,
          max_entries: 10000,
          current_entries: Math.floor(Math.random() * 8000 + 2000),
          start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'upcoming',
          scoring_system: 'ppr',
          salary_cap: 50000
        },
        {
          id: 'sample-4',
          name: 'MLB Home Run Derby',
          type: 'gpp',
          sport: 'mlb',
          entry_fee: 10,
          guaranteed_prize_pool: 50000,
          max_entries: 20000,
          current_entries: Math.floor(Math.random() * 15000 + 5000),
          start_time: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          status: 'upcoming',
          scoring_system: 'standard',
          salary_cap: 35000
        }
      ]
      
      // Filter sample contests based on request parameters
      let filtered = sampleContests
      if (sport !== 'all') {
        filtered = filtered.filter(c => c.sport === sport)
      }
      if (type !== 'all') {
        filtered = filtered.filter(c => c.type === type)
      }
      
      return NextResponse.json({ contests: filtered })
    }
    
    return NextResponse.json({ contests })
  } catch (error) {
    console.error('Error fetching contests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contests' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['name', 'type', 'sport', 'entry_fee', 'max_entries', 'start_time']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    
    // Create contest
    const { data, error } = await supabase
      .from('contests')
      .insert({
        ...body,
        current_entries: 0,
        status: 'upcoming',
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ contest: data })
  } catch (error) {
    console.error('Error creating contest:', error)
    return NextResponse.json(
      { error: 'Failed to create contest' },
      { status: 500 }
    )
  }
}