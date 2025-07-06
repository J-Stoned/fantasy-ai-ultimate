/**
 * WebSocket Service for Real-time Updates
 * Handles pattern alerts, game updates, and live data
 */

import { API_CONFIG, WS_CHANNELS } from './api-config'

export type WebSocketCallback = (data: any) => void

export interface WebSocketMessage {
  channel: string
  event: string
  data: any
  timestamp: Date
}

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private subscriptions: Map<string, Set<WebSocketCallback>> = new Map()
  private isConnecting: boolean = false
  private messageQueue: WebSocketMessage[] = []

  constructor() {
    if (API_CONFIG.ENABLE_WEBSOCKET) {
      this.connect()
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.isConnecting = true
    console.log('Connecting to WebSocket...')

    try {
      this.ws = new WebSocket(API_CONFIG.WEBSOCKET_URL)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.isConnecting = false
        this.flushMessageQueue()
        
        // Resubscribe to all channels
        this.subscriptions.forEach((_, channel) => {
          this.sendSubscription(channel)
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.isConnecting = false
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.isConnecting = false
        this.ws = null
        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('Error creating WebSocket:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.subscriptions.clear()
    this.messageQueue = []
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, callback: WebSocketCallback): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      
      // Send subscription if connected
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscription(channel)
      }
    }

    this.subscriptions.get(channel)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel)
          this.sendUnsubscription(channel)
        }
      }
    }
  }

  /**
   * Send a message to the server
   */
  send(channel: string, event: string, data: any): void {
    const message: WebSocketMessage = {
      channel,
      event,
      data,
      timestamp: new Date()
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      // Queue message for later
      this.messageQueue.push(message)
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    const callbacks = this.subscriptions.get(message.channel)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message.data)
        } catch (error) {
          console.error('Error in WebSocket callback:', error)
        }
      })
    }
  }

  /**
   * Send subscription request
   */
  private sendSubscription(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel
      }))
    }
  }

  /**
   * Send unsubscription request
   */
  private sendUnsubscription(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        channel
      }))
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || !API_CONFIG.ENABLE_WEBSOCKET) {
      return
    }

    console.log(`Reconnecting in ${API_CONFIG.WEBSOCKET_RECONNECT_DELAY}ms...`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, API_CONFIG.WEBSOCKET_RECONNECT_DELAY)
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!
      this.ws.send(JSON.stringify(message))
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService()

// Export channel constants for easy access
export { WS_CHANNELS } from './api-config'

// Helper hooks for React components
export function useWebSocket(channel: string, callback: WebSocketCallback) {
  // This will be implemented as a React hook in a separate file
  // For now, just return the subscribe function
  return websocketService.subscribe(channel, callback)
}