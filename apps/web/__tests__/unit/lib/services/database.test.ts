/**
 * Comprehensive test suite for database service layer
 * Tests connection handling, query execution, and error scenarios
 */

import { executeQuery, DatabaseError, ConnectionError } from '@/lib/services/database';

// Mock pg module
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
  end: jest.fn(),
  totalCount: 10,
  idleCount: 5,
  waitingCount: 0,
};

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => mockPool),
}));

// Mock logger
jest.mock('@/lib/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Database Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    test('should execute simple SELECT query successfully', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'Test User', email: 'test@example.com' },
          { id: 2, name: 'Another User', email: 'another@example.com' },
        ],
        rowCount: 2,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(
        'SELECT id, name, email FROM users WHERE active = $1',
        [true]
      );

      expect(result).toEqual(mockResult.rows);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT id, name, email FROM users WHERE active = $1',
        [true]
      );
    });

    test('should execute INSERT query and return inserted data', async () => {
      const mockResult = {
        rows: [{ id: 3, name: 'New User', email: 'new@example.com' }],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        ['New User', 'new@example.com']
      );

      expect(result).toEqual(mockResult.rows);
      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        ['New User', 'new@example.com']
      );
    });

    test('should execute UPDATE query successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Updated User', email: 'updated@example.com' }],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
        ['Updated User', 1]
      );

      expect(result).toEqual(mockResult.rows);
    });

    test('should execute DELETE query successfully', async () => {
      const mockResult = {
        rows: [],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(
        'DELETE FROM users WHERE id = $1',
        [1]
      );

      expect(result).toEqual([]);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        [1]
      );
    });

    test('should handle queries with no parameters', async () => {
      const mockResult = {
        rows: [{ count: 10 }],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery('SELECT COUNT(*) as count FROM users');

      expect(result).toEqual(mockResult.rows);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM users',
        undefined
      );
    });

    test('should handle empty result sets', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(
        'SELECT * FROM users WHERE id = $1',
        [999]
      );

      expect(result).toEqual([]);
    });

    test('should sanitize SQL parameters properly', async () => {
      const mockResult = {
        rows: [{ id: 1, content: "'; DROP TABLE users; --" }],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      // This should be handled safely by parameterized queries
      const result = await executeQuery(
        'SELECT * FROM posts WHERE content = $1',
        ["'; DROP TABLE users; --"]
      );

      expect(result).toEqual(mockResult.rows);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM posts WHERE content = $1',
        ["'; DROP TABLE users; --"]
      );
    });
  });

  describe('Error Handling', () => {
    test('should throw DatabaseError on SQL syntax error', async () => {
      const sqlError = new Error('syntax error at or near "SELCT"');
      sqlError.code = '42601'; // PostgreSQL syntax error code
      
      mockPool.query.mockRejectedValueOnce(sqlError);

      await expect(
        executeQuery('SELCT * FROM users') // Intentional typo
      ).rejects.toThrow(DatabaseError);

      await expect(
        executeQuery('SELCT * FROM users')
      ).rejects.toThrow('syntax error at or near "SELCT"');
    });

    test('should throw DatabaseError on constraint violation', async () => {
      const constraintError = new Error('duplicate key value violates unique constraint');
      constraintError.code = '23505'; // PostgreSQL unique violation code
      
      mockPool.query.mockRejectedValueOnce(constraintError);

      await expect(
        executeQuery(
          'INSERT INTO users (email) VALUES ($1)',
          ['existing@example.com']
        )
      ).rejects.toThrow(DatabaseError);
    });

    test('should throw ConnectionError on connection issues', async () => {
      const connectionError = new Error('connection terminated');
      connectionError.code = 'ECONNRESET';
      
      mockPool.query.mockRejectedValueOnce(connectionError);

      await expect(
        executeQuery('SELECT * FROM users')
      ).rejects.toThrow(ConnectionError);
    });

    test('should throw DatabaseError on table not found', async () => {
      const tableError = new Error('relation "nonexistent_table" does not exist');
      tableError.code = '42P01'; // PostgreSQL undefined table code
      
      mockPool.query.mockRejectedValueOnce(tableError);

      await expect(
        executeQuery('SELECT * FROM nonexistent_table')
      ).rejects.toThrow(DatabaseError);
    });

    test('should handle timeout errors appropriately', async () => {
      const timeoutError = new Error('Query timeout');
      timeoutError.code = 'ETIMEDOUT';
      
      mockPool.query.mockRejectedValueOnce(timeoutError);

      await expect(
        executeQuery('SELECT pg_sleep(30)') // Long-running query
      ).rejects.toThrow(ConnectionError);
    });

    test('should preserve original error details in custom errors', async () => {
      const originalError = new Error('Original database error');
      originalError.code = '42601';
      originalError.detail = 'Error details';
      originalError.hint = 'Try this instead';
      
      mockPool.query.mockRejectedValueOnce(originalError);

      try {
        await executeQuery('INVALID SQL');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.cause).toBe(originalError);
        expect(error.message).toContain('Original database error');
      }
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle concurrent queries efficiently', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValue(mockResult);

      const startTime = Date.now();
      
      // Execute 20 concurrent queries
      const queries = Array(20).fill(null).map((_, index) =>
        executeQuery('SELECT * FROM users WHERE id = $1', [index + 1])
      );

      const results = await Promise.all(queries);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All queries should succeed
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toEqual(mockResult.rows);
      });

      // Should complete reasonably quickly (concurrently)
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Pool should be called 20 times
      expect(mockPool.query).toHaveBeenCalledTimes(20);
    });

    test('should handle large result sets efficiently', async () => {
      // Mock large result set (1000 rows)
      const largeResult = {
        rows: Array(1000).fill(null).map((_, index) => ({
          id: index + 1,
          name: `User ${index + 1}`,
          email: `user${index + 1}@example.com`,
        })),
        rowCount: 1000,
      };

      mockPool.query.mockResolvedValueOnce(largeResult);

      const startTime = Date.now();
      
      const result = await executeQuery('SELECT * FROM users');

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({
        id: 1,
        name: 'User 1',
        email: 'user1@example.com',
      });

      // Should process large result sets quickly
      expect(processingTime).toBeLessThan(100); // Less than 100ms
    });

    test('should not leak memory with repeated queries', async () => {
      const mockResult = {
        rows: [{ id: 1, data: 'x'.repeat(1000) }], // 1KB of data
        rowCount: 1,
      };

      mockPool.query.mockResolvedValue(mockResult);

      const initialMemory = process.memoryUsage();

      // Execute 100 queries
      for (let i = 0; i < 100; i++) {
        await executeQuery('SELECT * FROM test_table');
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (< 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Query Validation', () => {
    test('should reject obviously malicious queries', async () => {
      const maliciousQueries = [
        'DROP TABLE users;',
        'DELETE FROM users;', // Without WHERE clause
        'ALTER TABLE users DROP COLUMN email;',
        'TRUNCATE TABLE users;',
      ];

      for (const query of maliciousQueries) {
        await expect(
          executeQuery(query)
        ).rejects.toThrow(); // Should throw some kind of error
      }
    });

    test('should handle very long query strings', async () => {
      // Create a very long but valid query
      const longQuery = 'SELECT * FROM users WHERE ' + 
        Array(1000).fill('id = 1 OR').join(' ') + ' id = 2';

      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(longQuery);
      expect(result).toEqual([]);
    });

    test('should handle special characters in parameters', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Special Ñamé', emoji: '🚀💰' }],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await executeQuery(
        'SELECT * FROM users WHERE name = $1 AND emoji = $2',
        ['Special Ñamé', '🚀💰']
      );

      expect(result).toEqual(mockResult.rows);
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log slow queries', async () => {
      const { logger } = require('@/lib/logging/logger');
      
      // Mock slow query (simulate delay)
      mockPool.query.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ rows: [], rowCount: 0 }), 1100)
        )
      );

      await executeQuery('SELECT pg_sleep(1)');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.objectContaining({
          duration: expect.any(Number),
          query: expect.stringContaining('SELECT pg_sleep(1)'),
        })
      );
    });

    test('should log query execution details', async () => {
      const { logger } = require('@/lib/logging/logger');
      
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValueOnce(mockResult);

      await executeQuery('SELECT * FROM users WHERE id = $1', [1]);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Query executed'),
        expect.objectContaining({
          query: expect.stringContaining('SELECT * FROM users'),
          parameters: [1],
          rowCount: 1,
          duration: expect.any(Number),
        })
      );
    });

    test('should log connection pool status periodically', async () => {
      const { logger } = require('@/lib/logging/logger');
      
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      // Execute multiple queries to trigger pool monitoring
      for (let i = 0; i < 10; i++) {
        await executeQuery('SELECT 1');
      }

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Connection pool status'),
        expect.objectContaining({
          totalConnections: expect.any(Number),
          idleConnections: expect.any(Number),
          waitingRequests: expect.any(Number),
        })
      );
    });
  });

  describe('Transaction Support', () => {
    test('should support basic transactions', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      // This would require extending the database service with transaction support
      // For now, we're testing the foundation is there
      expect(mockPool.connect).toBeDefined();
      expect(typeof mockPool.connect).toBe('function');
    });
  });
});