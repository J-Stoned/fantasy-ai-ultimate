#!/usr/bin/env node
/**
 * Service Orchestrator
 * Manages all microservices with health checks, auto-recovery, and monitoring
 * Achieves 5-star backend reliability
 */

import { spawn, ChildProcess } from 'child_process'
import colors from 'ansi-colors'
import axios from 'axios'
import { createServer } from 'http'
import express from 'express'
import { WebSocketServer } from 'ws'
import { EventEmitter } from 'events'

interface ServiceConfig {
  name: string
  command: string
  args: string[]
  port?: number
  healthEndpoint?: string
  healthInterval?: number
  maxRestarts?: number
  dependencies?: string[]
  env?: Record<string, string>
  critical?: boolean // If true, system fails if this service fails
}

interface ServiceStatus {
  name: string
  status: 'starting' | 'running' | 'failed' | 'stopped'
  pid?: number
  restarts: number
  lastRestart?: Date
  uptime?: number
  healthChecks: {
    passed: number
    failed: number
    lastCheck?: Date
  }
  logs: string[]
}

class ServiceOrchestrator extends EventEmitter {
  private services: Map<string, {
    config: ServiceConfig
    process?: ChildProcess
    status: ServiceStatus
    healthTimer?: NodeJS.Timer
  }> = new Map()
  
  private startupOrder: string[] = []
  private monitoringServer?: any
  private wss?: WebSocketServer
  
  constructor() {
    super()
    this.setupProcessHandlers()
  }
  
  // Service configurations
  private getServiceConfigs(): ServiceConfig[] {
    return [
      // Core Infrastructure
      // Redis is already running in Docker on port 6379
      // {
      //   name: 'redis',
      //   command: 'redis-server',
      //   args: ['--maxmemory', '4gb', '--maxmemory-policy', 'allkeys-lru'],
      //   port: 6379,
      //   healthEndpoint: 'redis://localhost:6379',
      //   critical: true,
      // },
      
      // Pattern Detection Services
      {
        name: 'pattern-api-v4',
        command: 'npx',
        args: ['tsx', 'scripts/production-pattern-api-v4.ts'],
        port: 3337,
        healthEndpoint: 'http://localhost:3337/api/v4/health',
        healthInterval: 30000,
        maxRestarts: 5,
        dependencies: [],
        env: {
          PORT: '3337',
          WORKERS: '4',
          ENABLE_CLUSTERING: 'true',
        },
        critical: true,
      },
      
      {
        name: 'unified-pattern-api',
        command: 'npx',
        args: ['tsx', 'scripts/unified-pattern-api.ts'],
        port: 3336,
        healthEndpoint: 'http://localhost:3336/api/unified/health',
        healthInterval: 30000,
        maxRestarts: 5,
        dependencies: [],
        env: {
          PORT: '3336',
          WORKERS: '4',
        },
        critical: true,
      },
      
      {
        name: 'fantasy-pattern-api',
        command: 'npx',
        args: ['tsx', 'scripts/unified-fantasy-pattern-api.ts'],
        port: 3340,
        healthEndpoint: 'http://localhost:3340/health',
        healthInterval: 30000,
        maxRestarts: 5,
        dependencies: [],
        env: {
          PORT: '3340',
          ENABLE_GPU: 'true',
        },
      },
      
      // WebSocket Server
      {
        name: 'websocket-server',
        command: 'npx',
        args: ['tsx', 'lib/streaming/start-websocket-server.ts'],
        port: 3338,
        healthEndpoint: 'ws://localhost:3338',
        healthInterval: 30000,
        maxRestarts: 3,
        dependencies: [],
        env: {
          WS_PORT: '3338',
          MAX_CONNECTIONS: '10000',
        },
      },
      
      // Data Collection
      {
        name: 'player-stats-collector',
        command: 'npx',
        args: ['tsx', 'scripts/enhanced-player-stats-collector.ts'],
        healthInterval: 60000,
        maxRestarts: 3,
        dependencies: ['pattern-api-v4'],
        env: {
          CONCURRENT_REQUESTS: '100',
        },
      },
      
      // Continuous Learning
      {
        name: 'continuous-learning',
        command: 'npx',
        args: ['tsx', 'scripts/continuous-learning-service.ts'],
        healthInterval: 60000,
        maxRestarts: 3,
        dependencies: ['pattern-api-v4'],
        env: {
          ENABLE_GPU: 'true',
        },
      },
      
      // Monitoring
      {
        name: 'production-monitoring',
        command: 'npx',
        args: ['tsx', 'scripts/production-monitoring.ts'],
        port: 3339,
        healthEndpoint: 'http://localhost:3339/health',
        healthInterval: 30000,
        dependencies: [],
      },
    ]
  }
  
  async start() {
    console.log(colors.green.bold('\n🚀 Fantasy AI Service Orchestrator Starting...\n'))
    
    // Start monitoring server
    this.startMonitoringServer()
    
    // Build dependency graph
    this.buildStartupOrder()
    
    // Start services in order
    for (const serviceName of this.startupOrder) {
      await this.startService(serviceName)
      
      // Wait for critical services to be healthy
      const service = this.services.get(serviceName)
      if (service?.config.critical) {
        await this.waitForHealthy(serviceName)
      }
    }
    
    console.log(colors.green.bold('\n✅ All services started successfully!\n'))
    this.printStatus()
  }
  
  private buildStartupOrder() {
    const configs = this.getServiceConfigs()
    const visited = new Set<string>()
    const order: string[] = []
    
    // Initialize services map
    configs.forEach(config => {
      this.services.set(config.name, {
        config,
        status: {
          name: config.name,
          status: 'stopped',
          restarts: 0,
          healthChecks: { passed: 0, failed: 0 },
          logs: [],
        },
      })
    })
    
    // Topological sort for dependencies
    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)
      
      const service = this.services.get(name)
      if (service?.config.dependencies) {
        service.config.dependencies.forEach(dep => visit(dep))
      }
      
      order.push(name)
    }
    
    configs.forEach(config => visit(config.name))
    this.startupOrder = order
  }
  
  private async startService(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) return
    
    console.log(colors.yellow(`Starting ${name}...`))
    service.status.status = 'starting'
    
    // Prepare environment
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      ...service.config.env,
    }
    
    // Spawn process
    const proc = spawn(service.config.command, service.config.args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    
    service.process = proc
    service.status.pid = proc.pid
    
    // Handle stdout
    proc.stdout?.on('data', (data) => {
      const log = data.toString().trim()
      service.status.logs.push(log)
      if (service.status.logs.length > 100) {
        service.status.logs.shift()
      }
      this.emit('log', { service: name, log, type: 'stdout' })
    })
    
    // Handle stderr
    proc.stderr?.on('data', (data) => {
      const log = data.toString().trim()
      service.status.logs.push(`ERROR: ${log}`)
      if (service.status.logs.length > 100) {
        service.status.logs.shift()
      }
      this.emit('log', { service: name, log, type: 'stderr' })
    })
    
    // Handle exit
    proc.on('exit', (code, signal) => {
      console.log(colors.red(`${name} exited with code ${code} signal ${signal}`))
      service.status.status = 'failed'
      this.handleServiceFailure(name)
    })
    
    // Wait a bit for startup
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Start health checks
    if (service.config.healthEndpoint) {
      this.startHealthChecks(name)
    } else {
      service.status.status = 'running'
    }
  }
  
  private startHealthChecks(name: string) {
    const service = this.services.get(name)
    if (!service) return
    
    const interval = service.config.healthInterval || 30000
    
    const check = async () => {
      try {
        if (service.config.healthEndpoint?.startsWith('ws://')) {
          // WebSocket health check
          await this.checkWebSocketHealth(service.config.healthEndpoint)
        } else if (service.config.healthEndpoint?.startsWith('redis://')) {
          // Redis health check
          await this.checkRedisHealth()
        } else {
          // HTTP health check
          await axios.get(service.config.healthEndpoint!, { timeout: 5000 })
        }
        
        service.status.healthChecks.passed++
        service.status.healthChecks.lastCheck = new Date()
        
        if (service.status.status === 'starting') {
          service.status.status = 'running'
          console.log(colors.green(`✓ ${name} is healthy`))
        }
      } catch (error) {
        service.status.healthChecks.failed++
        
        if (service.status.status === 'running') {
          console.log(colors.yellow(`⚠️  ${name} health check failed`))
        }
        
        // Mark as failed after 3 consecutive failures
        if (service.status.healthChecks.failed > 3) {
          service.status.status = 'failed'
          this.handleServiceFailure(name)
        }
      }
    }
    
    // Initial check
    setTimeout(check, 5000)
    
    // Regular checks
    service.healthTimer = setInterval(check, interval)
  }
  
  private async checkWebSocketHealth(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new (require('ws').WebSocket)(url)
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket health check timeout'))
      }, 5000)
      
      ws.on('open', () => {
        clearTimeout(timeout)
        ws.close()
        resolve()
      })
      
      ws.on('error', (err: Error) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }
  
  private async checkRedisHealth(): Promise<void> {
    const redis = require('redis')
    const client = redis.createClient()
    
    return new Promise((resolve, reject) => {
      client.on('error', reject)
      client.on('ready', () => {
        client.quit()
        resolve()
      })
    })
  }
  
  private async handleServiceFailure(name: string) {
    const service = this.services.get(name)
    if (!service) return
    
    // Clear health check timer
    if (service.healthTimer) {
      clearInterval(service.healthTimer)
    }
    
    // Check restart limit
    if (service.status.restarts >= (service.config.maxRestarts || 3)) {
      console.log(colors.red(`❌ ${name} exceeded restart limit`))
      
      if (service.config.critical) {
        console.log(colors.red.bold('\n💀 Critical service failed! Shutting down...'))
        process.exit(1)
      }
      
      return
    }
    
    // Attempt restart
    console.log(colors.yellow(`🔄 Restarting ${name} (attempt ${service.status.restarts + 1})...`))
    service.status.restarts++
    service.status.lastRestart = new Date()
    
    // Kill existing process
    if (service.process && !service.process.killed) {
      service.process.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (!service.process.killed) {
        service.process.kill('SIGKILL')
      }
    }
    
    // Wait before restart
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Restart
    await this.startService(name)
  }
  
  private async waitForHealthy(name: string, timeout = 60000): Promise<void> {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      const service = this.services.get(name)
      if (service?.status.status === 'running') {
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error(`${name} failed to become healthy within ${timeout}ms`)
  }
  
  private startMonitoringServer() {
    const app = express()
    
    // Status endpoint
    app.get('/status', (req, res) => {
      const status = Array.from(this.services.values()).map(s => ({
        name: s.config.name,
        status: s.status.status,
        pid: s.status.pid,
        restarts: s.status.restarts,
        uptime: s.status.pid ? process.uptime() : 0,
        healthChecks: s.status.healthChecks,
      }))
      
      res.json({ services: status })
    })
    
    // Logs endpoint
    app.get('/logs/:service', (req, res) => {
      const service = this.services.get(req.params.service)
      if (!service) {
        return res.status(404).json({ error: 'Service not found' })
      }
      
      res.json({ logs: service.status.logs })
    })
    
    // Health check
    app.get('/health', (req, res) => {
      const allHealthy = Array.from(this.services.values())
        .every(s => s.status.status === 'running' || s.status.status === 'stopped')
      
      res.status(allHealthy ? 200 : 503).json({
        healthy: allHealthy,
        timestamp: new Date(),
      })
    })
    
    const server = createServer(app)
    
    // WebSocket for real-time logs
    this.wss = new WebSocketServer({ server })
    
    this.wss.on('connection', (ws) => {
      console.log('Monitoring client connected')
      
      // Send current status
      ws.send(JSON.stringify({
        type: 'status',
        data: this.getFullStatus(),
      }))
      
      // Stream logs
      const logHandler = (data: any) => {
        ws.send(JSON.stringify({
          type: 'log',
          data,
        }))
      }
      
      this.on('log', logHandler)
      
      ws.on('close', () => {
        this.off('log', logHandler)
      })
    })
    
    server.listen(4000, () => {
      console.log(colors.cyan('📊 Monitoring server running on http://localhost:4000'))
    })
    
    this.monitoringServer = server
  }
  
  private getFullStatus() {
    return Array.from(this.services.values()).map(s => ({
      ...s.status,
      config: {
        name: s.config.name,
        port: s.config.port,
        critical: s.config.critical,
      },
    }))
  }
  
  private printStatus() {
    console.log(colors.cyan.bold('\n📊 Service Status:\n'))
    
    const table = Array.from(this.services.values()).map(s => ({
      Service: s.config.name,
      Status: s.status.status === 'running' ? colors.green('✓ Running') : 
              s.status.status === 'failed' ? colors.red('✗ Failed') :
              colors.yellow('○ ' + s.status.status),
      PID: s.status.pid || '-',
      Port: s.config.port || '-',
      Health: `${s.status.healthChecks.passed}/${s.status.healthChecks.passed + s.status.healthChecks.failed}`,
      Restarts: s.status.restarts,
    }))
    
    console.table(table)
    
    console.log(colors.cyan('\n📡 Monitoring: http://localhost:4000/status'))
    console.log(colors.cyan('📋 Logs: http://localhost:4000/logs/{service-name}'))
  }
  
  private setupProcessHandlers() {
    // Graceful shutdown
    const shutdown = async () => {
      console.log(colors.yellow('\n🛑 Shutting down services...'))
      
      // Stop in reverse order
      const shutdownOrder = [...this.startupOrder].reverse()
      
      for (const name of shutdownOrder) {
        const service = this.services.get(name)
        if (service?.process && !service.process.killed) {
          console.log(colors.yellow(`Stopping ${name}...`))
          service.process.kill('SIGTERM')
          
          // Give it time to shutdown gracefully
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          if (!service.process.killed) {
            service.process.kill('SIGKILL')
          }
        }
      }
      
      // Close monitoring server
      if (this.monitoringServer) {
        this.monitoringServer.close()
      }
      
      console.log(colors.green('✅ All services stopped'))
      process.exit(0)
    }
    
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error(colors.red('Uncaught Exception:'), error)
      shutdown()
    })
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error(colors.red('Unhandled Rejection at:'), promise, 'reason:', reason)
    })
  }
}

// CLI Commands
if (require.main === module) {
  const orchestrator = new ServiceOrchestrator()
  const command = process.argv[2]
  
  switch (command) {
    case 'start':
      orchestrator.start().catch(console.error)
      break
      
    case 'status':
      // Check status via monitoring endpoint
      axios.get('http://localhost:4000/status')
        .then(res => {
          console.log(colors.cyan.bold('\n📊 Service Status:\n'))
          console.table(res.data.services)
        })
        .catch(() => {
          console.error(colors.red('❌ Orchestrator not running'))
        })
      break
      
    default:
      console.log(colors.yellow(`
Fantasy AI Service Orchestrator

Usage:
  npx tsx scripts/service-orchestrator.ts start    - Start all services
  npx tsx scripts/service-orchestrator.ts status   - Check service status

Monitoring:
  http://localhost:4000/status - Service status JSON
  http://localhost:4000/logs/{service} - Service logs
  ws://localhost:4000 - Real-time log streaming
      `))
  }
}

export { ServiceOrchestrator }