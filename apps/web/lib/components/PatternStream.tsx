'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PatternAlert {
  id: string;
  type: 'hot_pick' | 'value_play' | 'fade_alert' | 'injury_update' | 'line_movement';
  pattern: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  data: {
    players?: string[];
    teams?: string[];
    game?: string;
    reason: string;
    timestamp: string;
  };
  voiceAlert?: string;
}

interface PatternStreamProps {
  maxAlerts?: number;
  autoSpeak?: boolean;
  onAlertClick?: (alert: PatternAlert) => void;
}

export function PatternStream({ 
  maxAlerts = 5, 
  autoSpeak = false,
  onAlertClick 
}: PatternStreamProps) {
  const [alerts, setAlerts] = useState<PatternAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const speechQueue = useRef<string[]>([]);

  useEffect(() => {
    connectToStream();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectToStream = () => {
    try {
      const ws = new WebSocket('ws://localhost:3340');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to pattern stream');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'pattern_alert') {
          handleNewAlert(data.alert);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('Disconnected from pattern stream');
        setConnected(false);
        // Attempt reconnect after 5 seconds
        setTimeout(connectToStream, 5000);
      };
    } catch (error) {
      console.error('Failed to connect to stream:', error);
      setConnected(false);
    }
  };

  const handleNewAlert = (alert: PatternAlert) => {
    setAlerts(prev => {
      const newAlerts = [alert, ...prev].slice(0, maxAlerts);
      return newAlerts;
    });

    // Queue voice alert if enabled
    if (autoSpeak && alert.voiceAlert) {
      speechQueue.current.push(alert.voiceAlert);
      processVoiceQueue();
    }
  };

  const processVoiceQueue = async () => {
    if (speaking || speechQueue.current.length === 0) return;
    
    setSpeaking(true);
    const text = speechQueue.current.shift()!;
    
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.onend = () => {
        setSpeaking(false);
        processVoiceQueue(); // Process next in queue
      };
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Speech error:', error);
      setSpeaking(false);
    }
  };

  const getAlertIcon = (type: PatternAlert['type']) => {
    switch (type) {
      case 'hot_pick': return '🔥';
      case 'value_play': return '💎';
      case 'fade_alert': return '⚠️';
      case 'injury_update': return '🏥';
      case 'line_movement': return '📊';
    }
  };

  const getAlertColor = (type: PatternAlert['type']) => {
    switch (type) {
      case 'hot_pick': return 'from-red-500 to-orange-500';
      case 'value_play': return 'from-blue-500 to-purple-500';
      case 'fade_alert': return 'from-yellow-500 to-red-500';
      case 'injury_update': return 'from-gray-500 to-gray-600';
      case 'line_movement': return 'from-green-500 to-teal-500';
    }
  };

  const getImpactBadge = (impact: PatternAlert['impact']) => {
    const colors = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[impact]}`}>
        {impact.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="pattern-stream">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          Live Pattern Stream
        </h3>
        
        {speaking && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="animate-pulse">🔊</span>
            Speaking alert...
          </div>
        )}
      </div>

      {/* Alert Stream */}
      <div className="space-y-3">
        <AnimatePresence>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-2xl mb-2">📡</div>
              <div className="text-sm">Waiting for pattern alerts...</div>
            </div>
          ) : (
            alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                onClick={() => onAlertClick?.(alert)}
                className="cursor-pointer"
              >
                <div className={`bg-gradient-to-r ${getAlertColor(alert.type)} p-[2px] rounded-lg`}>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getAlertIcon(alert.type)}</span>
                        <div>
                          <h4 className="font-semibold capitalize">
                            {alert.type.replace('_', ' ')}
                          </h4>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(alert.data.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{alert.confidence}%</span>
                        {getImpactBadge(alert.impact)}
                      </div>
                    </div>
                    
                    <p className="text-sm mb-2">{alert.data.reason}</p>
                    
                    {alert.data.players && alert.data.players.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {alert.data.players.map((player, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded"
                          >
                            {player}
                          </span>
                        ))}
                        {alert.data.teams?.map((team, idx) => (
                          <span
                            key={`team-${idx}`}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded"
                          >
                            {team}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Stream Controls */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          onClick={() => setAlerts([])}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Clear alerts
        </button>
        
        <div className="text-gray-600 dark:text-gray-400">
          {alerts.length} / {maxAlerts} alerts
        </div>
      </div>
    </div>
  );
}