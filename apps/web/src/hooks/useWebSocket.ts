/**
 * React hooks for WebSocket integration
 */

import { useEffect, useRef, useState } from 'react'
import { websocketService, WebSocketCallback } from '../services/websocket-service'

/**
 * Hook to subscribe to a WebSocket channel
 */
export function useWebSocket(channel: string, callback: WebSocketCallback) {
  const callbackRef = useRef(callback)
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  
  useEffect(() => {
    // Subscribe to channel
    const unsubscribe = websocketService.subscribe(channel, (data) => {
      callbackRef.current(data)
    })
    
    // Cleanup on unmount
    return unsubscribe
  }, [channel])
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false)
  
  useEffect(() => {
    const checkStatus = () => {
      setIsConnected(websocketService.isConnected())
    }
    
    // Check initial status
    checkStatus()
    
    // Check status periodically
    const interval = setInterval(checkStatus, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return isConnected
}