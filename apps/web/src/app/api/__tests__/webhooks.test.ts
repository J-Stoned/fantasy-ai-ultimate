import { POST } from '../webhooks/sports-data/route'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

// Mock dependencies
jest.mock('@/lib/supabase/client', () => ({
  getServiceSupabase: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: { id: 'test-id' }, 
            error: null 
          })),
        })),
      })),
    })),
  })),
}))

jest.mock('@/lib/config/server-config', () => ({
  serverConfig: {
    webhookSecrets: {
      sportsData: 'test-webhook-secret',
    },
  },
}))

describe('Sports Data Webhook API', () => {
  const webhookSecret = 'test-webhook-secret'
  
  function generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
  }

  function createMockRequest(
    payload: any,
    headers: Record<string, string> = {}
  ): NextRequest {
    const body = JSON.stringify(payload)
    const signature = generateSignature(body, webhookSecret)
    
    return {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-signature': signature,
        ...headers,
      }),
      json: async () => payload,
      text: async () => body,
    } as unknown as NextRequest
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Webhook validation', () => {
    it('should accept valid webhook with correct signature', async () => {
      const payload = {
        type: 'score.update',
        payload: {
          gameId: 'game-123',
          homeScore: 21,
          awayScore: 14,
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        type: 'score.update',
        payload: { gameId: 'game-123' },
      }

      const request = createMockRequest(payload, {
        'x-webhook-signature': 'invalid-signature',
      })

      const response = await POST(request)
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid webhook signature')
    })

    it('should reject webhook without signature', async () => {
      const request = {
        headers: new Headers({
          'content-type': 'application/json',
        }),
        json: async () => ({ type: 'test' }),
        text: async () => '{"type":"test"}',
      } as unknown as NextRequest

      const response = await POST(request)
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid webhook signature')
    })

    it('should validate webhook payload schema', async () => {
      const invalidPayload = {
        type: 'invalid.type',
        payload: {},
      }

      const request = createMockRequest(invalidPayload)
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid')
    })
  })

  describe('Event handling', () => {
    it('should handle game.started event', async () => {
      const payload = {
        type: 'game.started',
        payload: {
          gameId: 'game-123',
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          startTime: new Date().toISOString(),
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
      
      const { getServiceSupabase } = require('@/lib/supabase/client')
      const supabase = getServiceSupabase()
      expect(supabase.from).toHaveBeenCalledWith('games')
    })

    it('should handle game.ended event', async () => {
      const payload = {
        type: 'game.ended',
        payload: {
          gameId: 'game-123',
          finalScore: {
            home: 28,
            away: 21,
          },
          stats: {
            totalYards: { home: 350, away: 320 },
          },
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle score.update event', async () => {
      const payload = {
        type: 'score.update',
        payload: {
          gameId: 'game-123',
          homeScore: 14,
          awayScore: 7,
          quarter: 2,
          timeRemaining: '5:30',
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle player.injury event', async () => {
      const payload = {
        type: 'player.injury',
        payload: {
          playerId: 'player-123',
          status: 'Questionable',
          description: 'Knee injury',
          returnDate: '2024-01-15',
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
      
      const { getServiceSupabase } = require('@/lib/supabase/client')
      const supabase = getServiceSupabase()
      expect(supabase.from).toHaveBeenCalledWith('player_injuries')
    })

    it('should handle player.stats.update event', async () => {
      const payload = {
        type: 'player.stats.update',
        payload: {
          playerId: 'player-123',
          gameId: 'game-123',
          stats: {
            passingYards: 250,
            touchdowns: 2,
            interceptions: 0,
          },
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle trade.completed event', async () => {
      const payload = {
        type: 'trade.completed',
        payload: {
          playerId: 'player-123',
          fromTeamId: 'team-1',
          toTeamId: 'team-2',
          tradeDate: new Date().toISOString(),
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const { getServiceSupabase } = require('@/lib/supabase/client')
      getServiceSupabase.mockReturnValueOnce({
        from: jest.fn(() => ({
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ 
              data: null, 
              error: new Error('Database error') 
            })),
          })),
        })),
      })

      const payload = {
        type: 'score.update',
        payload: {
          gameId: 'game-123',
          homeScore: 14,
          awayScore: 7,
        },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to process webhook')
    })

    it('should handle malformed JSON', async () => {
      const request = {
        headers: new Headers({
          'content-type': 'application/json',
          'x-webhook-signature': 'some-signature',
        }),
        json: async () => {
          throw new Error('Invalid JSON')
        },
        text: async () => 'invalid json',
      } as unknown as NextRequest

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid request body')
    })

    it('should log webhook events', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const payload = {
        type: 'score.update',
        payload: { gameId: 'game-123', homeScore: 7, awayScore: 0 },
      }

      const request = createMockRequest(payload)
      await POST(request)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook received:'),
        'score.update'
      )

      consoleLogSpy.mockRestore()
    })

    it('should handle concurrent webhook requests', async () => {
      const payloads = Array(5).fill(null).map((_, i) => ({
        type: 'score.update',
        payload: {
          gameId: `game-${i}`,
          homeScore: i * 7,
          awayScore: i * 3,
        },
      }))

      const requests = payloads.map(p => POST(createMockRequest(p)))
      const responses = await Promise.all(requests)

      expect(responses).toHaveLength(5)
      expect(responses.every(r => r.status === 200)).toBe(true)
    })
  })

  describe('Security', () => {
    it('should not expose internal errors', async () => {
      const { getServiceSupabase } = require('@/lib/supabase/client')
      getServiceSupabase.mockImplementationOnce(() => {
        throw new Error('Internal database connection string exposed')
      })

      const payload = {
        type: 'score.update',
        payload: { gameId: 'game-123', homeScore: 0, awayScore: 0 },
      }

      const request = createMockRequest(payload)
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to process webhook')
      expect(data.error).not.toContain('connection string')
    })

    it('should validate all required fields', async () => {
      const incompletePayloads = [
        { type: 'game.started' }, // missing payload
        { type: 'game.started', payload: {} }, // missing required fields
        { type: 'player.injury', payload: { playerId: 'test' } }, // missing status
      ]

      for (const payload of incompletePayloads) {
        const request = createMockRequest(payload)
        const response = await POST(request)
        
        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toContain('Invalid')
      }
    })
  })

  describe('Performance', () => {
    it('should process webhooks quickly', async () => {
      const payload = {
        type: 'score.update',
        payload: {
          gameId: 'game-123',
          homeScore: 14,
          awayScore: 7,
        },
      }

      const request = createMockRequest(payload)
      
      const start = Date.now()
      await POST(request)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100) // Should be fast
    })
  })
})