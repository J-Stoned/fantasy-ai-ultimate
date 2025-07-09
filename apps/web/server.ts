/**
 * Custom Next.js Server with WebSocket Support
 * Integrates ProductionWebSocketManager for 10K+ concurrent connections
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { createProductionWebSocketServer } from '../../lib/realtime/ProductionWebSocketManager'
import { services } from '../../lib/services/init'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)
const websocketPort = parseInt(process.env.WEBSOCKET_PORT || '3001', 10)

// Create Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

async function startServer() {
  try {
    // Initialize all production services
    console.log('🚀 Initializing production services...')
    await services.initialize()

    // Prepare Next.js
    await app.prepare()

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    })

    // Create WebSocket server on the same HTTP server
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://fantasy-ai.com'
        ],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6,
      perMessageDeflate: {
        threshold: 1024
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
      }
    })

    // Initialize Production WebSocket Manager
    const wsManager = createProductionWebSocketServer(io)
    
    // Store WebSocket manager in global for API routes
    global.wsManager = wsManager

    // Start server
    server.listen(port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  FANTASY AI ULTIMATE v2.0                     ║
║                                                               ║
║  🚀 Server:     http://${hostname}:${port}                    ║
║  🔌 WebSocket:  ws://${hostname}:${port}                      ║
║  🎮 GPU:        ${services.getServices().gpu ? 'RTX 4060 READY' : 'CPU Mode'}                            ║
║  💾 Database:   Production Pool Active                        ║
║  🚦 Redis:      High-Performance Mode                         ║
║                                                               ║
║  Ready for Second Spectrum-level performance! 🏆              ║
╚═══════════════════════════════════════════════════════════════╝
      `)
    })

    // Set up real-time data subscriptions
    setupRealtimeSubscriptions(wsManager)

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server')
      
      // Shutdown WebSocket
      await wsManager.shutdown()
      
      // Shutdown services
      await services.shutdown()
      
      // Close server
      server.close(() => {
        console.log('HTTP server closed')
        process.exit(0)
      })
    })

  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

/**
 * Set up real-time data subscriptions
 */
function setupRealtimeSubscriptions(wsManager: any) {
  const { database, cache } = services.getServices()

  // Subscribe to game events
  database.realtime
    .channel('game-events')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'game_events' 
    }, async (payload) => {
      const event = payload.new
      
      // Broadcast to game room
      await wsManager.broadcastGameUpdate(event.game_id, {
        type: 'game-event',
        data: event
      })
      
      // Update cache
      await cache.del(`game:state:${event.game_id}`)
    })
    .subscribe()

  // Subscribe to player updates
  database.realtime
    .channel('player-updates')
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'players' 
    }, async (payload) => {
      const player = payload.new
      
      // Broadcast to player room
      await wsManager.broadcastPlayerUpdate(player.id, {
        type: 'player-update',
        data: player
      })
      
      // Invalidate cache
      await cache.del(`player:${player.id}`)
    })
    .subscribe()

  // Subscribe to lineup optimizations
  database.realtime
    .channel('lineup-optimizations')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'gpu_optimization_cache' 
    }, async (payload) => {
      const optimization = payload.new
      
      // Broadcast to users waiting for optimization
      await wsManager.broadcast('lineup:optimized', {
        cacheKey: optimization.cache_key,
        lineups: optimization.optimized_lineups,
        processingTime: optimization.processing_time_ms
      }, null, { priority: 'high' })
    })
    .subscribe()

  console.log('✅ Real-time subscriptions established')
}

// Extend global namespace
declare global {
  var wsManager: any
}

// Start the server
startServer().catch(console.error)