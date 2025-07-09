import { AgentOrchestrator } from '../AgentOrchestrator'
import { AgentContext, AgentResponse } from '../agents/BaseAgent'
import { QueryIntent } from '../services/QueryParser'
import { PlayerAnalysisAgent } from '../agents/consolidated/PlayerAnalysisAgent'
import { TeamManagementAgent } from '../agents/consolidated/TeamManagementAgent'
import { MarketAnalysisAgent } from '../agents/consolidated/MarketAnalysisAgent'
import { GamePredictionAgent } from '../agents/consolidated/GamePredictionAgent'

// Mock all agent imports
jest.mock('../agents/consolidated/PlayerAnalysisAgent')
jest.mock('../agents/consolidated/TeamManagementAgent')
jest.mock('../agents/consolidated/MarketAnalysisAgent')
jest.mock('../agents/consolidated/GamePredictionAgent')
jest.mock('../services/QueryParser')

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator
  let mockContext: AgentContext
  let mockPlayerAgent: jest.Mocked<PlayerAnalysisAgent>
  let mockTeamAgent: jest.Mocked<TeamManagementAgent>
  let mockMarketAgent: jest.Mocked<MarketAnalysisAgent>
  let mockGameAgent: jest.Mocked<GamePredictionAgent>

  beforeEach(() => {
    // Create mock agents
    mockPlayerAgent = {
      getName: jest.fn(() => 'Player Analysis Expert'),
      process: jest.fn(),
      canHandle: jest.fn(() => true),
    } as any

    mockTeamAgent = {
      getName: jest.fn(() => 'Team Management Expert'),
      process: jest.fn(),
      canHandle: jest.fn(() => true),
    } as any

    mockMarketAgent = {
      getName: jest.fn(() => 'Market Analysis Expert'),
      process: jest.fn(),
      canHandle: jest.fn(() => true),
    } as any

    mockGameAgent = {
      getName: jest.fn(() => 'Game Prediction Expert'),
      process: jest.fn(),
      canHandle: jest.fn(() => true),
    } as any

    // Mock constructors
    ;(PlayerAnalysisAgent as jest.Mock).mockImplementation(() => mockPlayerAgent)
    ;(TeamManagementAgent as jest.Mock).mockImplementation(() => mockTeamAgent)
    ;(MarketAnalysisAgent as jest.Mock).mockImplementation(() => mockMarketAgent)
    ;(GamePredictionAgent as jest.Mock).mockImplementation(() => mockGameAgent)

    // Create orchestrator
    orchestrator = new AgentOrchestrator()
    
    // Mock context
    mockContext = {
      userId: 'user-123',
      sessionId: 'session-456',
      leagueId: 'league-789',
      fantasyTeamId: 'team-abc',
      query: 'test query',
      timestamp: new Date(),
    }
  })

  describe('Agent Selection', () => {
    it('should route player stats queries to PlayerAnalysisAgent', async () => {
      const query = 'Show me Justin Jefferson stats'
      mockPlayerAgent.process.mockResolvedValue({
        success: true,
        message: 'Player stats retrieved',
      })

      // Mock QueryParser to return PLAYER_STATS intent
      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.PLAYER_STATS,
        entities: { players: ['Justin Jefferson'] },
        confidence: 0.9,
      }))

      const result = await orchestrator.processQuery(query, mockContext)

      expect(result.agent).toBe('Player Analysis Expert')
      expect(mockPlayerAgent.process).toHaveBeenCalledWith(query, mockContext)
    })

    it('should route trade queries to TeamManagementAgent', async () => {
      const query = 'Should I trade Tyreek Hill for Davante Adams?'
      mockTeamAgent.process.mockResolvedValue({
        success: true,
        message: 'Trade analysis complete',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.TRADE_ANALYSIS,
        entities: { players: ['Tyreek Hill', 'Davante Adams'] },
        confidence: 0.85,
      }))

      const result = await orchestrator.processQuery(query, mockContext)

      expect(result.agent).toBe('Team Management Expert')
      expect(mockTeamAgent.process).toHaveBeenCalledWith(query, mockContext)
    })

    it('should route news queries to MarketAnalysisAgent', async () => {
      const query = 'Any injury news on Patrick Mahomes?'
      mockMarketAgent.process.mockResolvedValue({
        success: true,
        message: 'Latest news retrieved',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.NEWS_UPDATE,
        entities: { players: ['Patrick Mahomes'] },
        confidence: 0.8,
      }))

      const result = await orchestrator.processQuery(query, mockContext)

      expect(result.agent).toBe('Market Analysis Expert')
      expect(mockMarketAgent.process).toHaveBeenCalledWith(query, mockContext)
    })

    it('should route matchup queries to GamePredictionAgent', async () => {
      const query = 'How will Saquon do against the Cowboys?'
      mockGameAgent.process.mockResolvedValue({
        success: true,
        message: 'Matchup analysis complete',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.MATCHUP_ANALYSIS,
        entities: { players: ['Saquon'], teams: ['Cowboys'] },
        confidence: 0.9,
      }))

      const result = await orchestrator.processQuery(query, mockContext)

      expect(result.agent).toBe('Game Prediction Expert')
      expect(mockGameAgent.process).toHaveBeenCalledWith(query, mockContext)
    })
  })

  describe('Fallback Handling', () => {
    it('should try fallback agents when primary fails with low confidence', async () => {
      const query = 'Tell me about fantasy football'
      
      // Primary agent fails
      mockPlayerAgent.process.mockResolvedValue({
        success: false,
        message: 'Unable to process',
      })

      // Fallback agent succeeds
      mockTeamAgent.process.mockResolvedValue({
        success: true,
        message: 'Here is general fantasy football info',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.GENERAL_HELP,
        entities: {},
        confidence: 0.5, // Low confidence triggers fallback
      }))

      const result = await orchestrator.processQuery(query, mockContext)

      expect(result.agent).toBe('Team Management Expert')
      expect(mockPlayerAgent.process).toHaveBeenCalled()
      expect(mockTeamAgent.process).toHaveBeenCalled()
    })

    it('should return error response when all agents fail', async () => {
      const query = 'Unknown query type'
      
      // All agents fail
      mockPlayerAgent.process.mockResolvedValue({ success: false, message: 'Failed' })
      mockTeamAgent.process.mockResolvedValue({ success: false, message: 'Failed' })
      mockMarketAgent.process.mockResolvedValue({ success: false, message: 'Failed' })
      mockGameAgent.process.mockResolvedValue({ success: false, message: 'Failed' })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.UNKNOWN,
        entities: {},
        confidence: 0.3,
      }))

      const result = await orchestrator.processQuery(query, mockContext)

      expect(result.response.success).toBe(false)
      expect(result.response.message).toContain("couldn't find a suitable answer")
    })
  })

  describe('Multi-Agent Queries', () => {
    it('should process query with multiple relevant agents', async () => {
      const query = 'Compare players and show me trade options'
      
      mockPlayerAgent.process.mockResolvedValue({
        success: true,
        message: 'Player comparison complete',
      })
      
      mockTeamAgent.process.mockResolvedValue({
        success: true,
        message: 'Trade options analyzed',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.PLAYER_COMPARISON,
        entities: { players: ['Player A', 'Player B'] },
        confidence: 0.8,
      }))

      const result = await orchestrator.processMultiAgentQuery(query, mockContext, 2)

      expect(result.agents).toHaveLength(2)
      expect(result.summary).toContain('Multi-Agent Analysis')
    })

    it('should limit agents to maxAgents parameter', async () => {
      const query = 'Complex query needing all agents'
      
      // All agents can handle
      mockPlayerAgent.canHandle.mockReturnValue(true)
      mockTeamAgent.canHandle.mockReturnValue(true)
      mockMarketAgent.canHandle.mockReturnValue(true)
      mockGameAgent.canHandle.mockReturnValue(true)

      // All succeed
      const mockResponse = { success: true, message: 'Success' }
      mockPlayerAgent.process.mockResolvedValue(mockResponse)
      mockTeamAgent.process.mockResolvedValue(mockResponse)
      mockMarketAgent.process.mockResolvedValue(mockResponse)
      mockGameAgent.process.mockResolvedValue(mockResponse)

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.GENERAL_HELP,
        entities: {},
        confidence: 0.7,
      }))

      const result = await orchestrator.processMultiAgentQuery(query, mockContext, 2)

      expect(result.agents).toHaveLength(2)
    })

    it('should generate comprehensive summary from multiple agents', async () => {
      const query = 'Full analysis needed'
      
      mockPlayerAgent.process.mockResolvedValue({
        success: true,
        message: 'Player insight: Great form recently',
        suggestions: ['Start this player'],
      })
      
      mockTeamAgent.process.mockResolvedValue({
        success: true,
        message: 'Team insight: Good trade opportunity',
        suggestions: ['Make the trade'],
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.GENERAL_HELP,
        entities: {},
        confidence: 0.8,
      }))

      const result = await orchestrator.processMultiAgentQuery(query, mockContext)

      expect(result.summary).toContain('Player Analysis Expert')
      expect(result.summary).toContain('Team Management Expert')
      expect(result.summary).toContain('Combined Recommendations')
    })
  })

  describe('Error Handling', () => {
    it('should handle agent processing errors gracefully', async () => {
      const query = 'Test query'
      
      mockPlayerAgent.process.mockRejectedValue(new Error('Agent crashed'))

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.PLAYER_STATS,
        entities: {},
        confidence: 0.9,
      }))

      // Should not throw, but return error response
      const result = await orchestrator.processQuery(query, mockContext)
      
      expect(result.response.success).toBe(false)
    })

    it('should handle query parser errors', async () => {
      const query = 'Malformed query'
      
      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => {
        throw new Error('Parser error')
      })

      // Should not throw
      await expect(
        orchestrator.processQuery(query, mockContext)
      ).rejects.toThrow()
    })
  })

  describe('Agent Statistics', () => {
    it('should return agent statistics', () => {
      const stats = orchestrator.getAgentStats()
      
      expect(stats.size).toBe(4)
      expect(stats.has('Player Analysis Expert')).toBe(true)
      expect(stats.has('Team Management Expert')).toBe(true)
      expect(stats.has('Market Analysis Expert')).toBe(true)
      expect(stats.has('Game Prediction Expert')).toBe(true)
    })

    it('should list available agents with capabilities', () => {
      const agents = orchestrator.getAvailableAgents()
      
      expect(agents).toHaveLength(4)
      expect(agents[0].name).toBe('Player Analysis Expert')
      expect(agents[0].handles).toContain('stats')
      expect(agents[1].name).toBe('Team Management Expert')
      expect(agents[1].handles).toContain('trades')
    })
  })

  describe('Performance', () => {
    it('should process queries within reasonable time', async () => {
      const query = 'Quick query'
      mockPlayerAgent.process.mockResolvedValue({
        success: true,
        message: 'Quick response',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.PLAYER_STATS,
        entities: {},
        confidence: 0.9,
      }))

      const start = Date.now()
      await orchestrator.processQuery(query, mockContext)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100) // Should be fast for unit test
    })

    it('should handle concurrent queries', async () => {
      const queries = [
        'Query 1',
        'Query 2',
        'Query 3',
      ]

      mockPlayerAgent.process.mockResolvedValue({
        success: true,
        message: 'Response',
      })

      const mockQueryParser = (orchestrator as any).queryParser
      mockQueryParser.parseQuery = jest.fn(() => ({
        intent: QueryIntent.PLAYER_STATS,
        entities: {},
        confidence: 0.9,
      }))

      // Process all queries concurrently
      const results = await Promise.all(
        queries.map(q => orchestrator.processQuery(q, mockContext))
      )

      expect(results).toHaveLength(3)
      expect(results.every(r => r.response.success)).toBe(true)
    })
  })
})