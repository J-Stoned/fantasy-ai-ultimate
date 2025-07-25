import { http, HttpResponse } from 'msw'
import { mockUser, mockContest, mockPlayer, mockLeague } from '../helpers/test-utils'

// API endpoint handlers for testing
export const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        success: true,
        user: mockUser,
        token: 'mock-jwt-token'
      })
    }
    
    return HttpResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/auth/check', ({ request }) => {
    const authorization = request.headers.get('authorization')
    
    if (authorization === 'Bearer mock-jwt-token') {
      return HttpResponse.json({
        success: true,
        user: mockUser
      })
    }
    
    return HttpResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }),

  // Contest endpoints
  http.get('/api/contests', () => {
    return HttpResponse.json({
      success: true,
      contests: [mockContest]
    })
  }),

  http.get('/api/contests/:id', ({ params }) => {
    return HttpResponse.json({
      success: true,
      contest: { ...mockContest, id: params.id }
    })
  }),

  http.post('/api/contests/:id/enter', async ({ params, request }) => {
    const body = await request.json() as { lineup: any[]; entryFee: number }
    
    return HttpResponse.json({
      success: true,
      entry: {
        id: 'entry-123',
        contestId: params.id,
        lineup: body.lineup,
        entryFee: body.entryFee,
        timestamp: new Date().toISOString()
      }
    })
  }),

  // Player endpoints
  http.get('/api/players', ({ request }) => {
    const url = new URL(request.url)
    const sport = url.searchParams.get('sport')
    const position = url.searchParams.get('position')
    
    let players = [mockPlayer]
    
    if (position) {
      players = players.filter(p => p.position === position)
    }
    
    return HttpResponse.json({
      success: true,
      players,
      total: players.length
    })
  }),

  // League endpoints
  http.get('/api/leagues', () => {
    return HttpResponse.json({
      success: true,
      leagues: [mockLeague]
    })
  }),

  http.post('/api/leagues/create', async ({ request }) => {
    const body = await request.json() as any
    
    return HttpResponse.json({
      success: true,
      league: {
        ...mockLeague,
        ...body,
        id: 'new-league-123'
      }
    })
  }),

  // Bankroll endpoints
  http.get('/api/bankroll/user', () => {
    return HttpResponse.json({
      success: true,
      bankroll: {
        current: 1000,
        available: 800,
        reserved: 200,
        maxSingleBet: 100,
        maxTotalExposure: 300
      }
    })
  }),

  http.post('/api/bankroll/kelly', async ({ request }) => {
    const body = await request.json() as { 
      entryFee: number; 
      winProbability: number; 
      expectedReturn: number 
    }
    
    return HttpResponse.json({
      success: true,
      recommendation: {
        recommendedBetSize: body.entryFee * 0.1,
        kellyFraction: 0.1,
        maxRecommendedEntries: 5,
        riskAssessment: 'moderate'
      }
    })
  }),

  // ML Prediction endpoints
  http.post('/api/predictions/players', async ({ request }) => {
    const body = await request.json() as { playerIds: string[]; sport: string }
    
    return HttpResponse.json({
      success: true,
      predictions: body.playerIds.map(id => ({
        playerId: id,
        projection: Math.random() * 30 + 5,
        confidence: Math.random() * 0.3 + 0.7,
        floor: Math.random() * 10 + 5,
        ceiling: Math.random() * 20 + 25
      }))
    })
  }),

  // Admin endpoints
  http.get('/api/admin/stats', ({ request }) => {
    const authorization = request.headers.get('authorization')
    
    if (!authorization?.includes('admin-token')) {
      return HttpResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }
    
    return HttpResponse.json({
      success: true,
      stats: {
        totalUsers: 1250,
        activeContests: 45,
        totalVolume: 125000,
        mlAccuracy: 0.8651
      }
    })
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        websocket: 'running'
      }
    })
  }),

  // Error simulation endpoints
  http.get('/api/error/500', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }),

  http.get('/api/error/timeout', () => {
    return new Promise(() => {
      // Never resolve to simulate timeout
    })
  }),

  // Rate limiting test
  http.get('/api/rate-limit-test', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  })
]