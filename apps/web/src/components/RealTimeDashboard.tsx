'use client';

import React from 'react';
import { useGameUpdates, useMLPredictions, useNotifications, useVoiceUpdates } from '../lib/hooks/useWebSocket';
import { useAuth } from '../lib/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

export function RealTimeDashboard() {
  const { user } = useAuth();
  const { isConnected: gameConnected, gameUpdate } = useGameUpdates();
  const { isConnected: mlConnected, predictions } = useMLPredictions();
  const { isConnected: notifConnected, notifications, markAsRead } = useNotifications(user?.id);
  const { isConnected: voiceConnected, voiceCommand, isProcessing } = useVoiceUpdates();

  const isFullyConnected = gameConnected && mlConnected && notifConnected && voiceConnected;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* Connection Status */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Real-Time Connection</h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isFullyConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isFullyConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Game Updates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🏈</span>
          Live Game Updates
        </h3>
        {gameUpdate ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex justify-between">
              <span className="font-medium">{gameUpdate.home_team}</span>
              <span className="text-xl font-bold">{gameUpdate.home_score}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{gameUpdate.away_team}</span>
              <span className="text-xl font-bold">{gameUpdate.away_score}</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {gameUpdate.status} - {gameUpdate.time_remaining}
            </div>
          </motion.div>
        ) : (
          <p className="text-gray-500">Waiting for game updates...</p>
        )}
      </div>

      {/* ML Predictions Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          AI Predictions
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {predictions.length > 0 ? (
              predictions.map((prediction, index) => (
                <motion.div
                  key={prediction.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{prediction.player_name}</span>
                    <span className={`text-sm font-bold ${
                      prediction.confidence > 0.8 ? 'text-green-600' : 
                      prediction.confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(prediction.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {prediction.prediction_type}: {prediction.value}
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-gray-500">No predictions yet...</p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🔔</span>
          Notifications
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    notification.read 
                      ? 'bg-gray-50 dark:bg-gray-700' 
                      : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </p>
                </motion.div>
              ))
            ) : (
              <p className="text-gray-500">No notifications</p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Voice Command Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🎤</span>
          Voice Assistant
        </h3>
        {voiceCommand ? (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Command:</p>
              <p className="font-medium">{voiceCommand.transcript}</p>
            </div>
            {isProcessing && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-2 text-blue-600"
              >
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                <span className="text-sm">Processing...</span>
              </motion.div>
            )}
            {voiceCommand.response && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">Response:</p>
                <p>{voiceCommand.response}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Say "Hey Fantasy" to activate</p>
        )}
      </div>
    </div>
  );
}