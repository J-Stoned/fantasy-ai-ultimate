import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport') || 'nfl'
    const position = searchParams.get('position') || 'ALL'
    const contestId = searchParams.get('contestId')
    
    // Query real players from database with DFS salaries
    let query = supabase
      .from('players')
      .select(`
        id,
        name,
        position,
        team_id,
        teams!players_team_id_fkey (
          abbreviation,
          name
        )
      `)
      .eq('sport', sport)
      .eq('active', true)
      .limit(100)
    
    if (position !== 'ALL') {
      query = query.eq('position', position)
    }
    
    const { data: players, error } = await query
    
    if (error) {
      throw error
    }
    
    // If we have real players, fetch their DFS data
    if (players && players.length > 0) {
      // Get player stats for projections
      const playerIds = players.map(p => p.id)
      const { data: stats } = await supabase
        .from('player_stats')
        .select('player_id, stat_type, stat_value')
        .in('player_id', playerIds)
        .in('stat_type', ['fantasy_points_avg', 'ownership_projection', 'salary_draftkings'])
      
      // Transform to player objects with DFS data
      const dfsPlayers = players.map(player => {
        const playerStats = stats?.filter(s => s.player_id === player.id) || []
        const fantasyPoints = playerStats.find(s => s.stat_type === 'fantasy_points_avg')?.stat_value || Math.random() * 20 + 5
        const ownership = playerStats.find(s => s.stat_type === 'ownership_projection')?.stat_value || Math.random() * 30 + 5
        const salary = playerStats.find(s => s.stat_type === 'salary_draftkings')?.stat_value || generateSalaryByPosition(player.position)
        
        return {
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.teams?.abbreviation || 'FA',
          salary: salary,
          projectedPoints: parseFloat(fantasyPoints.toFixed(1)),
          ownership: parseFloat(ownership.toFixed(1)),
          value: parseFloat((fantasyPoints / (salary / 1000)).toFixed(2))
        }
      })
      
      return NextResponse.json({ players: dfsPlayers })
    }
    
    // Fallback sample data if no players in DB
    const samplePlayers = [
      {
        id: 'sample-1',
        name: 'Patrick Mahomes',
        position: 'QB',
        team: 'KC',
        salary: 8500,
        projectedPoints: 28.5,
        ownership: 18.5,
        value: 3.35,
      },
      {
        id: 'sample-2',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        salary: 8200,
        projectedPoints: 27.2,
        ownership: 22.1,
        value: 3.32,
      },
      {
        id: 'sample-3',
        name: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        salary: 9000,
        projectedPoints: 24.5,
        ownership: 35.2,
        value: 2.72,
      },
      {
        id: 'sample-4',
        name: 'Austin Ekeler',
        position: 'RB',
        team: 'LAC',
        salary: 7800,
        projectedPoints: 19.8,
        ownership: 28.7,
        value: 2.54,
      },
      {
        id: 'sample-5',
        name: 'Tyreek Hill',
        position: 'WR',
        team: 'MIA',
        salary: 8800,
        projectedPoints: 22.3,
        ownership: 31.2,
        value: 2.53,
      },
      {
        id: 'sample-6',
        name: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        salary: 8600,
        projectedPoints: 21.8,
        ownership: 29.5,
        value: 2.53,
      },
      {
        id: 'sample-7',
        name: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        salary: 7500,
        projectedPoints: 18.5,
        ownership: 42.3,
        value: 2.47,
      },
      {
        id: 'sample-8',
        name: 'Bills DST',
        position: 'DST',
        team: 'BUF',
        salary: 3200,
        projectedPoints: 9.5,
        ownership: 15.2,
        value: 2.97,
      },
    ]
    
    // Filter sample data by position if needed
    let filtered = samplePlayers
    if (position !== 'ALL') {
      filtered = filtered.filter(p => p.position === position)
    }
    
    return NextResponse.json({ players: filtered })
  } catch (error) {
    console.error('Error fetching players:', error)
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

function generateSalaryByPosition(position: string): number {
  const salaryRanges: Record<string, [number, number]> = {
    QB: [6500, 8500],
    RB: [4500, 9000],
    WR: [3500, 8800],
    TE: [3000, 7500],
    DST: [2500, 3500],
    K: [4000, 5000],
  }
  
  const range = salaryRanges[position] || [3000, 6000]
  return Math.floor(Math.random() * (range[1] - range[0]) + range[0])
}