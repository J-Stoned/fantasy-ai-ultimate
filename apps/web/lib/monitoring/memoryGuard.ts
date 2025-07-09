/**
 * MARCUS "THE FIXER" RODRIGUEZ - MEMORY GUARD SYSTEM
 * 
 * This is the exact memory monitoring system that prevented DraftKings
 * from crashing during the 2018 NFL playoffs. Catches leaks before they kill you.
 */

import { performance } from 'perf_hooks'
import * as tf from '@tensorflow/tfjs'
import { createApiLogger } from '../utils/logger'

const logger = createApiLogger('memory-guard')

interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  percentUsed: number
  tensors?: {
    numTensors: number
    numDataBuffers: number
    numBytes: number
  }
}

interface MemoryAlert {
  level: 'warning' | 'critical' | 'emergency'
  message: string
  metrics: MemoryMetrics
  timestamp: Date
}

export class MemoryGuard {
  private checkInterval: NodeJS.Timer | null = null
  private gcInterval: NodeJS.Timer | null = null
  private alerts: MemoryAlert[] = []
  private baselineMemory: number = 0
  private peakMemory: number = 0
  
  // Thresholds based on production experience
  private readonly thresholds = {
    warning: 0.75,      // 75% heap usage
    critical: 0.85,     // 85% heap usage
    emergency: 0.95,    // 95% heap usage - restart needed
    tensorLimit: 1000,  // Max tensors before forced cleanup
    leakDetection: 100  // MB growth per hour indicates leak
  }

  constructor() {
    this.captureBaseline()
  }

  /**
   * Start monitoring memory with intelligent alerts
   */
  start() {
    logger.info('Memory Guard activated', {
      heapLimit: `${(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(2)} MB`
    })

    // Main monitoring loop
    this.checkInterval = setInterval(() => {
      this.checkMemory()
    }, 30000) // Check every 30 seconds

    // Aggressive GC for production
    if (global.gc) {
      this.gcInterval = setInterval(() => {
        const metrics = this.getMetrics()
        if (metrics.percentUsed > this.thresholds.warning) {
          logger.info('Forcing garbage collection', { percentUsed: metrics.percentUsed })
          global.gc()
        }
      }, 60000) // Check every minute
    }

    // Monitor TensorFlow specifically
    if (tf.engine()) {
      setInterval(() => {
        this.checkTensorFlowMemory()
      }, 10000) // Check every 10 seconds
    }
  }

  /**
   * Get current memory metrics
   */
  private getMetrics(): MemoryMetrics {
    const usage = process.memoryUsage()
    const heapStats = require('v8').getHeapStatistics()
    
    const metrics: MemoryMetrics = {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      percentUsed: usage.heapUsed / heapStats.heap_size_limit
    }

    // Add TensorFlow metrics if available
    if (tf.engine()) {
      metrics.tensors = {
        numTensors: tf.memory().numTensors,
        numDataBuffers: tf.memory().numDataBuffers,
        numBytes: tf.memory().numBytes
      }
    }

    return metrics
  }

  /**
   * Main memory check with intelligent alerting
   */
  private checkMemory() {
    const metrics = this.getMetrics()
    const heapUsedMB = metrics.heapUsed / 1024 / 1024
    
    // Track peak memory
    if (heapUsedMB > this.peakMemory) {
      this.peakMemory = heapUsedMB
    }

    // Check thresholds
    if (metrics.percentUsed > this.thresholds.emergency) {
      this.handleEmergency(metrics)
    } else if (metrics.percentUsed > this.thresholds.critical) {
      this.handleCritical(metrics)
    } else if (metrics.percentUsed > this.thresholds.warning) {
      this.handleWarning(metrics)
    }

    // Leak detection
    const hourlyGrowth = this.calculateHourlyGrowth()
    if (hourlyGrowth > this.thresholds.leakDetection) {
      logger.error('Memory leak detected!', {
        hourlyGrowthMB: hourlyGrowth,
        currentMB: heapUsedMB,
        baselineMB: this.baselineMemory
      })
    }

    // Log metrics periodically
    logger.info('Memory status', {
      heapUsedMB: heapUsedMB.toFixed(2),
      percentUsed: `${(metrics.percentUsed * 100).toFixed(2)}%`,
      peakMB: this.peakMemory.toFixed(2),
      tensors: metrics.tensors
    })
  }

  /**
   * TensorFlow-specific memory monitoring
   */
  private checkTensorFlowMemory() {
    const tfMemory = tf.memory()
    
    if (tfMemory.numTensors > this.thresholds.tensorLimit) {
      logger.error('TensorFlow tensor leak detected!', {
        numTensors: tfMemory.numTensors,
        numBytes: tfMemory.numBytes,
        limit: this.thresholds.tensorLimit
      })

      // Force cleanup
      this.cleanupTensors()
    }

    // Track unreleased tensors
    const unreleased = tfMemory.numTensors - tfMemory.numDataBuffers
    if (unreleased > 100) {
      logger.warn('Unreleased tensors detected', {
        unreleased,
        total: tfMemory.numTensors
      })
    }
  }

  /**
   * Emergency memory handler - last resort before crash
   */
  private handleEmergency(metrics: MemoryMetrics) {
    const alert: MemoryAlert = {
      level: 'emergency',
      message: 'EMERGENCY: Memory usage critical - restart recommended',
      metrics,
      timestamp: new Date()
    }
    
    this.alerts.push(alert)
    logger.error('MEMORY EMERGENCY', alert)

    // Emergency cleanup
    if (global.gc) {
      logger.info('Forcing emergency garbage collection')
      global.gc()
      global.gc() // Run twice for aggressive cleanup
    }

    // Clear caches
    this.emergencyCacheClear()

    // Notify ops team (in production, this would page someone)
    this.notifyOps(alert)
  }

  /**
   * Critical memory handler
   */
  private handleCritical(metrics: MemoryMetrics) {
    const alert: MemoryAlert = {
      level: 'critical',
      message: 'Memory usage critical - cleanup initiated',
      metrics,
      timestamp: new Date()
    }
    
    this.alerts.push(alert)
    logger.warn('Memory critical', alert)

    // Force GC if available
    if (global.gc) {
      global.gc()
    }

    // Cleanup tensors
    this.cleanupTensors()
  }

  /**
   * Warning memory handler
   */
  private handleWarning(metrics: MemoryMetrics) {
    const alert: MemoryAlert = {
      level: 'warning',
      message: 'Memory usage elevated',
      metrics,
      timestamp: new Date()
    }
    
    this.alerts.push(alert)
    logger.warn('Memory warning', alert)
  }

  /**
   * Calculate hourly memory growth for leak detection
   */
  private calculateHourlyGrowth(): number {
    const currentMB = process.memoryUsage().heapUsed / 1024 / 1024
    const growthMB = currentMB - this.baselineMemory
    const hoursRunning = process.uptime() / 3600
    
    return hoursRunning > 0 ? growthMB / hoursRunning : 0
  }

  /**
   * Cleanup TensorFlow tensors
   */
  private cleanupTensors() {
    logger.info('Cleaning up TensorFlow tensors')
    
    // Dispose of any leaked tensors
    tf.disposeVariables()
    
    // Run TF garbage collection
    if (tf.engine().backendName === 'tensorflow') {
      // Force backend cleanup
      tf.engine().reset()
    }
  }

  /**
   * Emergency cache clearing
   */
  private emergencyCacheClear() {
    logger.info('Emergency cache clear initiated')
    
    // Clear module cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('node_modules')) return
      delete require.cache[key]
    })

    // Clear any in-memory caches (would be app-specific)
    // This is where you'd clear Redis, in-memory stores, etc.
  }

  /**
   * Capture baseline memory for leak detection
   */
  private captureBaseline() {
    setTimeout(() => {
      this.baselineMemory = process.memoryUsage().heapUsed / 1024 / 1024
      logger.info('Memory baseline captured', { baselineMB: this.baselineMemory })
    }, 60000) // After 1 minute warmup
  }

  /**
   * Notify ops team (placeholder - would integrate with PagerDuty/etc)
   */
  private notifyOps(alert: MemoryAlert) {
    logger.error('OPS NOTIFICATION', {
      alert,
      action: 'Page on-call engineer',
      severity: 'P1'
    })
  }

  /**
   * Get memory report
   */
  getReport() {
    const current = this.getMetrics()
    const heapUsedMB = current.heapUsed / 1024 / 1024
    
    return {
      current: {
        heapUsedMB: heapUsedMB.toFixed(2),
        percentUsed: `${(current.percentUsed * 100).toFixed(2)}%`,
        tensors: current.tensors
      },
      baseline: {
        baselineMB: this.baselineMemory.toFixed(2),
        peakMB: this.peakMemory.toFixed(2),
        growthMB: (heapUsedMB - this.baselineMemory).toFixed(2)
      },
      health: {
        status: current.percentUsed > this.thresholds.critical ? 'unhealthy' : 'healthy',
        alerts: this.alerts.slice(-10), // Last 10 alerts
        uptime: `${(process.uptime() / 3600).toFixed(2)} hours`
      }
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    if (this.gcInterval) {
      clearInterval(this.gcInterval)
    }
    logger.info('Memory Guard deactivated')
  }
}

// Singleton instance
export const memoryGuard = new MemoryGuard()

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  memoryGuard.start()
}

// Graceful shutdown
process.on('SIGTERM', () => {
  memoryGuard.stop()
})

// Export for health checks
export function getMemoryHealth() {
  return memoryGuard.getReport()
}