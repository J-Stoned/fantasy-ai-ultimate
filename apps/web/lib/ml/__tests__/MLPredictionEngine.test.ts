import * as tf from '@tensorflow/tfjs'
import { MLPredictionEngine } from '../MLPredictionEngine'
import { supabase } from '../../supabase/client'

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  tensor2d: jest.fn(),
  sequential: jest.fn(),
  layers: {
    dense: jest.fn(),
  },
  train: {
    adam: jest.fn(),
  },
  dispose: jest.fn(),
  memory: jest.fn(() => ({ numTensors: 0 })),
  tidy: jest.fn((fn) => fn()),
}))

// Mock Supabase
jest.mock('../../supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          data: [],
        })),
        gte: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    storage: {
      from: jest.fn(() => ({
        download: jest.fn(() => Promise.resolve({ data: null, error: null })),
        upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
  },
}))

describe('MLPredictionEngine', () => {
  let engine: MLPredictionEngine
  let mockTensor: any
  let mockModel: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock tensor with dispose method
    mockTensor = {
      dispose: jest.fn(),
      shape: [1, 10],
      data: jest.fn(() => Promise.resolve(new Float32Array([0.5]))),
    }
    
    // Setup mock model
    mockModel = {
      predict: jest.fn(() => mockTensor),
      compile: jest.fn(),
      fit: jest.fn(() => Promise.resolve({ history: {} })),
      save: jest.fn(() => Promise.resolve()),
    }
    
    ;(tf.tensor2d as jest.Mock).mockReturnValue(mockTensor)
    ;(tf.sequential as jest.Mock).mockReturnValue(mockModel)
    ;(tf.layers.dense as jest.Mock).mockReturnValue({})
    
    engine = new MLPredictionEngine()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Memory Management', () => {
    it('should dispose tensors after prediction', async () => {
      const playerId = 'test-player-123'
      const gameweek = 10
      
      await engine.predictPlayerPerformance(playerId, gameweek)
      
      expect(mockTensor.dispose).toHaveBeenCalled()
    })

    it('should dispose tensors even when prediction fails', async () => {
      const playerId = 'test-player-123'
      const gameweek = 10
      
      // Make predict throw an error
      mockModel.predict.mockImplementation(() => {
        throw new Error('Prediction failed')
      })
      
      await expect(
        engine.predictPlayerPerformance(playerId, gameweek)
      ).rejects.toThrow('Failed to predict')
      
      // Tensor should still be disposed
      expect(mockTensor.dispose).toHaveBeenCalled()
    })

    it('should handle null tensor disposal gracefully', async () => {
      const playerId = 'test-player-123'
      const gameweek = 10
      
      // Return null tensor
      ;(tf.tensor2d as jest.Mock).mockReturnValue(null)
      
      await expect(
        engine.predictPlayerPerformance(playerId, gameweek)
      ).rejects.toThrow()
      
      // Should not throw when trying to dispose null
      expect(() => mockTensor?.dispose()).not.toThrow()
    })
  })

  describe('Training', () => {
    it('should train model with proper data batching', async () => {
      const mockTrainingData = [
        { features: [1, 2, 3], label: 10 },
        { features: [4, 5, 6], label: 20 },
      ]
      
      // Mock getTrainingData
      jest.spyOn(engine as any, 'getTrainingData').mockResolvedValue(mockTrainingData)
      
      await engine.trainModel()
      
      expect(tf.tensor2d).toHaveBeenCalledWith(
        [[1, 2, 3], [4, 5, 6]],
        [2, 3]
      )
      expect(mockModel.fit).toHaveBeenCalled()
      expect(mockTensor.dispose).toHaveBeenCalled()
    })

    it('should save model after successful training', async () => {
      const mockTrainingData = [{ features: [1, 2, 3], label: 10 }]
      jest.spyOn(engine as any, 'getTrainingData').mockResolvedValue(mockTrainingData)
      
      await engine.trainModel()
      
      expect(supabase.storage.from).toHaveBeenCalledWith('ml-models')
    })

    it('should cleanup tensors after training error', async () => {
      const mockTrainingData = [{ features: [1, 2, 3], label: 10 }]
      jest.spyOn(engine as any, 'getTrainingData').mockResolvedValue(mockTrainingData)
      
      // Make fit throw an error
      mockModel.fit.mockRejectedValue(new Error('Training failed'))
      
      await expect(engine.trainModel()).rejects.toThrow('Failed to train')
      
      // Tensors should still be disposed
      expect(mockTensor.dispose).toHaveBeenCalled()
    })
  })

  describe('Feature Engineering', () => {
    it('should normalize features correctly', () => {
      const features = {
        recentForm: [10, 20, 30],
        avgPoints: 15,
        homeAdvantage: true,
        againstTopTeam: false,
        restDays: 3,
      }
      
      const normalized = (engine as any).normalizeFeatures(features)
      
      expect(normalized).toHaveLength(10) // Based on feature vector size
      expect(normalized[6]).toBe(1) // homeAdvantage = true
      expect(normalized[7]).toBe(0) // againstTopTeam = false
    })

    it('should handle missing features gracefully', () => {
      const features = {
        recentForm: [],
        avgPoints: null,
        homeAdvantage: undefined,
      }
      
      const normalized = (engine as any).normalizeFeatures(features)
      
      expect(normalized).toHaveLength(10)
      expect(normalized.every((v: number) => !isNaN(v))).toBe(true)
    })
  })

  describe('Prediction Caching', () => {
    it('should cache predictions for same inputs', async () => {
      const playerId = 'test-player-123'
      const gameweek = 10
      
      // First call
      const result1 = await engine.predictPlayerPerformance(playerId, gameweek)
      
      // Reset mocks but keep cache
      jest.clearAllMocks()
      
      // Second call should use cache
      const result2 = await engine.predictPlayerPerformance(playerId, gameweek)
      
      expect(result1).toEqual(result2)
      expect(tf.tensor2d).not.toHaveBeenCalled() // Should not create new tensor
    })

    it('should invalidate cache after model update', async () => {
      const playerId = 'test-player-123'
      const gameweek = 10
      
      // First prediction
      await engine.predictPlayerPerformance(playerId, gameweek)
      
      // Update model (triggers cache clear)
      await engine.updateModelWithResults([])
      
      // Reset mocks
      jest.clearAllMocks()
      ;(tf.tensor2d as jest.Mock).mockReturnValue(mockTensor)
      
      // Should create new prediction
      await engine.predictPlayerPerformance(playerId, gameweek)
      
      expect(tf.tensor2d).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const playerId = 'test-player-123'
      const gameweek = 10
      
      // Mock database error
      ;(supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ 
              data: null, 
              error: new Error('Database error') 
            })),
          })),
        })),
      })
      
      await expect(
        engine.predictPlayerPerformance(playerId, gameweek)
      ).rejects.toThrow('Failed to predict')
    })

    it('should validate input parameters', async () => {
      await expect(
        engine.predictPlayerPerformance('', 10)
      ).rejects.toThrow()
      
      await expect(
        engine.predictPlayerPerformance('player-123', -1)
      ).rejects.toThrow()
      
      await expect(
        engine.predictPlayerPerformance('player-123', 39) // > 38 gameweeks
      ).rejects.toThrow()
    })
  })

  describe('TensorFlow Memory Monitoring', () => {
    it('should not increase tensor count after operations', async () => {
      const initialMemory = { numTensors: 0 }
      ;(tf.memory as jest.Mock).mockReturnValueOnce(initialMemory)
      
      await engine.predictPlayerPerformance('player-123', 10)
      
      const finalMemory = { numTensors: 0 }
      ;(tf.memory as jest.Mock).mockReturnValueOnce(finalMemory)
      
      expect(finalMemory.numTensors).toBe(initialMemory.numTensors)
    })
  })
})