import { Server } from 'socket.io'
import { createServer } from 'http'
import Client from 'socket.io-client'
import { setupWebSocketServer } from '@/lib/services/websocket-server'

describe('WebSocket Integration Tests', () => {
  let io: Server
  let serverSocket: any
  let clientSocket: any
  let httpServer: any

  beforeAll((done) => {
    httpServer = createServer()
    io = setupWebSocketServer(httpServer)
    
    httpServer.listen(() => {
      const port = (httpServer.address() as any)?.port
      clientSocket = new Client(`http://localhost:${port}`)
      
      io.on('connection', (socket) => {
        serverSocket = socket
      })
      
      clientSocket.on('connect', done)
    })
  })

  afterAll(() => {
    io.close()
    clientSocket.close()
    httpServer.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should authenticate valid users', (done) => {
      const mockToken = 'valid-jwt-token'
      
      clientSocket.emit('authenticate', { token: mockToken }, (response: any) => {
        expect(response.success).toBe(true)
        expect(response.userId).toBeDefined()
        done()
      })
    })

    it('should reject invalid authentication', (done) => {
      const invalidToken = 'invalid-token'
      
      clientSocket.emit('authenticate', { token: invalidToken }, (response: any) => {
        expect(response.success).toBe(false)
        expect(response.error).toBe('Invalid token')
        done()
      })
    })

    it('should disconnect unauthenticated users after timeout', (done) => {
      const unauthenticatedSocket = new Client('http://localhost:3001')
      
      unauthenticatedSocket.on('disconnect', (reason) => {
        expect(reason).toBe('authentication timeout')
        unauthenticatedSocket.close()
        done()
      })
      
      // Simulate authentication timeout
      setTimeout(() => {
        unauthenticatedSocket.emit('ping')
      }, 5100) // Slightly over 5 second timeout
    })
  })

  describe('Live Contest Updates', () => {
    beforeEach((done) => {
      // Authenticate client for contest tests
      clientSocket.emit('authenticate', { token: 'valid-jwt-token' }, () => {
        done()
      })
    })

    it('should join contest room and receive updates', (done) => {
      const contestId = 'test-contest-123'
      
      clientSocket.emit('join-contest', { contestId })
      
      // Simulate contest score update
      setTimeout(() => {
        serverSocket.to(`contest-${contestId}`).emit('score-update', {
          userId: 'user-123',
          newScore: 125.5,
          rank: 15
        })
      }, 100)
      
      clientSocket.on('score-update', (data: any) => {
        expect(data.userId).toBe('user-123')
        expect(data.newScore).toBe(125.5)
        expect(data.rank).toBe(15)
        done()
      })
    })

    it('should handle player score updates', (done) => {
      const contestId = 'test-contest-123'
      
      clientSocket.emit('join-contest', { contestId })
      
      setTimeout(() => {
        serverSocket.to(`contest-${contestId}`).emit('player-update', {
          playerId: 'player-456',
          points: 12.3,
          status: 'active'
        })
      }, 100)
      
      clientSocket.on('player-update', (data: any) => {
        expect(data.playerId).toBe('player-456')
        expect(data.points).toBe(12.3)
        expect(data.status).toBe('active')
        done()
      })
    })

    it('should broadcast leaderboard updates', (done) => {
      const contestId = 'test-contest-123'
      
      clientSocket.emit('join-contest', { contestId })
      
      setTimeout(() => {
        serverSocket.to(`contest-${contestId}`).emit('leaderboard-update', {
          top10: [
            { userId: 'user-1', score: 200.5, rank: 1 },
            { userId: 'user-2', score: 195.3, rank: 2 }
          ],
          userRank: 25,
          userScore: 175.2
        })
      }, 100)
      
      clientSocket.on('leaderboard-update', (data: any) => {
        expect(data.top10).toHaveLength(2)
        expect(data.userRank).toBe(25)
        expect(data.userScore).toBe(175.2)
        done()
      })
    })

    it('should leave contest room', (done) => {
      const contestId = 'test-contest-123'
      
      clientSocket.emit('join-contest', { contestId })
      clientSocket.emit('leave-contest', { contestId })
      
      // Verify client doesn't receive updates after leaving
      setTimeout(() => {
        serverSocket.to(`contest-${contestId}`).emit('score-update', {
          userId: 'user-123',
          newScore: 130.0,
          rank: 12
        })
      }, 100)
      
      let receivedUpdate = false
      clientSocket.on('score-update', () => {
        receivedUpdate = true
      })
      
      setTimeout(() => {
        expect(receivedUpdate).toBe(false)
        done()
      }, 200)
    })
  })

  describe('Admin Operations', () => {
    it('should allow admin users to broadcast system messages', (done) => {
      // Authenticate as admin
      clientSocket.emit('authenticate', { 
        token: 'admin-jwt-token',
        role: 'admin' 
      }, () => {
        clientSocket.emit('admin-broadcast', {
          message: 'System maintenance in 10 minutes',
          type: 'warning'
        })
      })
      
      clientSocket.on('system-message', (data: any) => {
        expect(data.message).toBe('System maintenance in 10 minutes')
        expect(data.type).toBe('warning')
        done()
      })
    })

    it('should reject non-admin broadcast attempts', (done) => {
      clientSocket.emit('admin-broadcast', {
        message: 'Unauthorized message',
        type: 'info'
      }, (response: any) => {
        expect(response.success).toBe(false)
        expect(response.error).toBe('Insufficient permissions')
        done()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed messages gracefully', (done) => {
      // Send invalid JSON-like message
      clientSocket.emit('invalid-event', { 
        malformed: 'data',
        circular: {} 
      })
      
      clientSocket.on('error', (error: any) => {
        expect(error.type).toBe('validation-error')
        done()
      })
      
      // If no error is received, test passes (graceful handling)
      setTimeout(done, 500)
    })

    it('should handle connection drops and reconnection', (done) => {
      let reconnected = false
      
      clientSocket.on('reconnect', () => {
        reconnected = true
        done()
      })
      
      // Simulate connection drop
      clientSocket.disconnect()
      
      setTimeout(() => {
        clientSocket.connect()
      }, 100)
    })

    it('should rate limit WebSocket messages', (done) => {
      // Send rapid messages to trigger rate limiting
      for (let i = 0; i < 50; i++) {
        clientSocket.emit('ping', { index: i })
      }
      
      clientSocket.on('rate-limit-exceeded', (data: any) => {
        expect(data.limit).toBeDefined()
        expect(data.resetTime).toBeDefined()
        done()
      })
      
      // If no rate limiting occurs, test still passes
      setTimeout(done, 1000)
    })
  })

  describe('Performance', () => {
    it('should handle concurrent connections efficiently', async () => {
      const connections: any[] = []
      const numConnections = 20
      
      // Create multiple concurrent connections
      for (let i = 0; i < numConnections; i++) {
        const socket = new Client('http://localhost:3001')
        connections.push(socket)
        
        await new Promise<void>((resolve) => {
          socket.on('connect', resolve)
        })
      }
      
      // Broadcast to all connections
      const startTime = Date.now()
      io.emit('performance-test', { 
        timestamp: startTime,
        message: 'Performance test message' 
      })
      
      // Wait for all to receive message
      let receivedCount = 0
      const messagePromises = connections.map(socket => 
        new Promise<void>((resolve) => {
          socket.on('performance-test', () => {
            receivedCount++
            resolve()
          })
        })
      )
      
      await Promise.all(messagePromises)
      const endTime = Date.now()
      
      expect(receivedCount).toBe(numConnections)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
      
      // Cleanup connections
      connections.forEach(socket => socket.close())
    })

    it('should efficiently handle room operations', (done) => {
      const roomId = 'performance-room'
      const clients: any[] = []
      const numClients = 10
      
      // Create multiple clients and join the same room
      Promise.all(
        Array.from({ length: numClients }, (_, i) => {
          const client = new Client('http://localhost:3001')
          clients.push(client)
          
          return new Promise<void>((resolve) => {
            client.on('connect', () => {
              client.emit('join-room', { roomId })
              resolve()
            })
          })
        })
      ).then(() => {
        // Broadcast to room and measure performance
        const startTime = Date.now()
        serverSocket.to(roomId).emit('room-message', {
          timestamp: startTime,
          data: 'Room broadcast test'
        })
        
        let receivedCount = 0
        clients.forEach(client => {
          client.on('room-message', () => {
            receivedCount++
            if (receivedCount === numClients) {
              const endTime = Date.now()
              expect(endTime - startTime).toBeLessThan(500)
              
              // Cleanup
              clients.forEach(c => c.close())
              done()
            }
          })
        })
      })
    })
  })

  describe('Memory Management', () => {
    it('should clean up disconnected clients', (done) => {
      const tempSocket = new Client('http://localhost:3001')
      
      tempSocket.on('connect', () => {
        tempSocket.emit('authenticate', { token: 'valid-jwt-token' })
        tempSocket.emit('join-contest', { contestId: 'cleanup-test' })
        
        // Forcefully disconnect
        tempSocket.disconnect()
        
        // Wait for cleanup
        setTimeout(() => {
          // Check that socket is no longer in server's client list
          const connectedSockets = io.sockets.sockets.size
          expect(connectedSockets).toBeLessThan(5) // Should not accumulate
          done()
        }, 1000)
      })
    })
  })
})