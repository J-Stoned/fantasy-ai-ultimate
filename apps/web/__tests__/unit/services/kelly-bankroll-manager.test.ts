import { KellyBankrollManager } from '@/lib/services/kelly-bankroll-manager'

// Mock the API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('KellyBankrollManager', () => {
  let manager: KellyBankrollManager

  beforeEach(() => {
    manager = new KellyBankrollManager()
    mockFetch.mockClear()
  })

  describe('getBankrollStatus', () => {
    it('should fetch and return bankroll status', async () => {
      const mockStatus = {
        current: 1000,
        available: 800,
        reserved: 200,
        maxSingleBet: 100,
        maxTotalExposure: 300
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockStatus })
      })

      const result = await manager.getBankrollStatus('user-123')
      
      expect(result).toEqual(mockStatus)
      expect(mockFetch).toHaveBeenCalledWith('/api/bankroll/user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-123'
        }
      })
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      })

      await expect(manager.getBankrollStatus('user-123'))
        .rejects.toThrow('Failed to fetch bankroll status')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'))

      await expect(manager.getBankrollStatus('user-123'))
        .rejects.toThrow('Network Error')
    })
  })

  describe('calculateKellyBet', () => {
    it('should calculate optimal bet size using Kelly Criterion', async () => {
      const mockRecommendation = {
        recommendedBetSize: 25,
        kellyFraction: 0.05,
        maxRecommendedEntries: 4,
        riskAssessment: 'moderate'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, recommendation: mockRecommendation })
      })

      const params = {
        entryFee: 25,
        winProbability: 0.15,
        expectedReturn: 2.5,
        bankroll: 1000
      }

      const result = await manager.calculateKellyBet('user-123', params)
      
      expect(result).toEqual(mockRecommendation)
      expect(mockFetch).toHaveBeenCalledWith('/api/bankroll/kelly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-123'
        },
        body: JSON.stringify(params)
      })
    })

    it('should validate input parameters', async () => {
      const invalidParams = {
        entryFee: -25, // negative entry fee
        winProbability: 1.5, // probability > 1
        expectedReturn: -1, // negative return
        bankroll: 0 // zero bankroll
      }

      await expect(manager.calculateKellyBet('user-123', invalidParams))
        .rejects.toThrow('Invalid parameters')
    })

    it('should handle zero probability edge case', async () => {
      const params = {
        entryFee: 25,
        winProbability: 0, // zero probability
        expectedReturn: 2.5,
        bankroll: 1000
      }

      const result = await manager.calculateKellyBet('user-123', params)
      expect(result.recommendedBetSize).toBe(0)
      expect(result.kellyFraction).toBe(0)
    })
  })

  describe('getRiskProfile', () => {
    it('should return conservative risk profile for new users', async () => {
      const mockProfile = {
        level: 'conservative',
        settings: {
          label: 'Conservative',
          kellyMultiplier: 0.25,
          maxSingleBet: 50,
          maxTotalExposure: 200,
          description: 'Low risk, steady growth'
        },
        healthScore: 85,
        healthLabel: 'Good',
        recommendations: [
          'Start with smaller entry fees',
          'Focus on cash games initially'
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, profile: mockProfile })
      })

      const result = await manager.getRiskProfile('new-user-123')
      
      expect(result.level).toBe('conservative')
      expect(result.healthScore).toBeGreaterThan(80)
      expect(result.recommendations).toHaveLength(2)
    })

    it('should adjust risk profile based on user performance', async () => {
      const mockExperiencedProfile = {
        level: 'aggressive',
        settings: {
          label: 'Aggressive',
          kellyMultiplier: 1.0,
          maxSingleBet: 200,
          maxTotalExposure: 500,
          description: 'High risk, high reward'
        },
        healthScore: 92,
        healthLabel: 'Excellent',
        recommendations: [
          'Consider tournament play',
          'Diversify across multiple sports'
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, profile: mockExperiencedProfile })
      })

      const result = await manager.getRiskProfile('experienced-user-123')
      
      expect(result.level).toBe('aggressive')
      expect(result.settings.kellyMultiplier).toBe(1.0)
      expect(result.healthScore).toBeGreaterThan(90)
    })
  })

  describe('getPerformanceMetrics', () => {
    it('should calculate accurate performance metrics', async () => {
      const mockPerformance = {
        totalContests: 150,
        winningContests: 45,
        winRate: '30.0%',
        totalWagered: 3750,
        totalReturns: 4125,
        roi: '10.0%',
        maxDrawdown: '-15.5%',
        avgPnl: 2.5,
        bestWin: 250,
        worstLoss: -75
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, performance: mockPerformance })
      })

      const result = await manager.getPerformanceMetrics('user-123')
      
      expect(result.winRate).toBe('30.0%')
      expect(result.roi).toBe('10.0%')
      expect(result.totalContests).toBe(150)
      expect(result.avgPnl).toBeGreaterThan(0)
    })

    it('should handle users with no contest history', async () => {
      const mockEmptyPerformance = {
        totalContests: 0,
        winningContests: 0,
        winRate: '0.0%',
        totalWagered: 0,
        totalReturns: 0,
        roi: '0.0%',
        maxDrawdown: '0.0%',
        avgPnl: 0,
        bestWin: 0,
        worstLoss: 0
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, performance: mockEmptyPerformance })
      })

      const result = await manager.getPerformanceMetrics('new-user-123')
      
      expect(result.totalContests).toBe(0)
      expect(result.winRate).toBe('0.0%')
      expect(result.roi).toBe('0.0%')
    })
  })

  describe('getContestRecommendations', () => {
    it('should recommend appropriate contests based on bankroll', async () => {
      const mockRecommendations = [
        {
          contestId: 'contest-1',
          contestName: 'NFL Sunday $5 50-50',
          contestType: 'Cash',
          entryFee: 5,
          recommendedBetSize: 5,
          maxEntries: 1,
          expectedReturn: 1.8,
          riskLevel: 'low',
          reason: 'Good for beginners'
        },
        {
          contestId: 'contest-2',
          contestName: 'NBA $25 GPP',
          contestType: 'GPP',
          entryFee: 25,
          recommendedBetSize: 25,
          maxEntries: 2,
          expectedReturn: 3.2,
          riskLevel: 'medium',
          reason: 'Balanced risk/reward'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, recommendations: mockRecommendations })
      })

      const params = {
        sport: 'NFL',
        maxEntryFee: 50,
        riskTolerance: 'moderate'
      }

      const result = await manager.getContestRecommendations('user-123', params)
      
      expect(result).toHaveLength(2)
      expect(result[0].contestType).toBe('Cash')
      expect(result[1].contestType).toBe('GPP')
      expect(result.every(r => r.entryFee <= 50)).toBe(true)
    })

    it('should filter recommendations by risk tolerance', async () => {
      const conservativeRecommendations = [
        {
          contestId: 'contest-1',
          contestName: 'Low-risk Cash Game',
          contestType: 'Cash',
          entryFee: 5,
          recommendedBetSize: 5,
          maxEntries: 1,
          expectedReturn: 1.8,
          riskLevel: 'low'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, recommendations: conservativeRecommendations })
      })

      const params = {
        sport: 'NFL',
        maxEntryFee: 10,
        riskTolerance: 'conservative'
      }

      const result = await manager.getContestRecommendations('user-123', params)
      
      expect(result).toHaveLength(1)
      expect(result[0].riskLevel).toBe('low')
      expect(result[0].entryFee).toBeLessThanOrEqual(10)
    })
  })

  describe('updateBankroll', () => {
    it('should update bankroll after contest completion', async () => {
      const contestResult = {
        contestId: 'contest-123',
        entryFee: 25,
        payout: 45,
        profit: 20,
        position: 15,
        totalEntries: 100
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, updated: true })
      })

      const result = await manager.updateBankroll('user-123', contestResult)
      
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/bankroll/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-123'
        },
        body: JSON.stringify(contestResult)
      })
    })

    it('should handle bankroll update failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid contest result' })
      })

      const contestResult = {
        contestId: 'invalid-contest',
        entryFee: -25, // invalid negative entry fee
        payout: 0,
        profit: -25
      }

      await expect(manager.updateBankroll('user-123', contestResult))
        .rejects.toThrow('Failed to update bankroll')
    })
  })
})