'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Play, 
  Pause, 
  AlertTriangle,
  Volume2,
  VolumeX,
  Timer
} from 'lucide-react';
import { DraftTimerUpdate } from '@/lib/hooks/useDraftWebSocket';

interface DraftTimerProps {
  timerUpdate: DraftTimerUpdate | null;
  isMyTurn: boolean;
  isPaused: boolean;
  onTimeExpired?: () => void;
  className?: string;
}

export function DraftTimer({ 
  timerUpdate, 
  isMyTurn, 
  isPaused,
  onTimeExpired,
  className = '' 
}: DraftTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const audioRef = useRef<HTMLAudioElement>();

  // Initialize audio
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.3;
    }
  }, []);

  // Update timer from WebSocket
  useEffect(() => {
    if (timerUpdate) {
      setTimeRemaining(timerUpdate.timeRemaining);
    }
  }, [timerUpdate]);

  // Timer countdown logic
  useEffect(() => {
    if (isPaused || timeRemaining <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // Check for warning and critical states
        if (newTime <= 30 && newTime > 10) {
          setIsWarning(true);
          setIsCritical(false);
        } else if (newTime <= 10 && newTime > 0) {
          setIsWarning(false);
          setIsCritical(true);
          
          // Play warning sound for last 10 seconds
          if (soundEnabled && isMyTurn && audioRef.current) {
            playSound('tick');
          }
        } else if (newTime <= 0) {
          setIsWarning(false);
          setIsCritical(false);
          
          // Play timeout sound
          if (soundEnabled && audioRef.current) {
            playSound('timeout');
          }
          
          // Trigger timeout callback
          if (onTimeExpired) {
            onTimeExpired();
          }
          
          return 0;
        } else {
          setIsWarning(false);
          setIsCritical(false);
        }
        
        return newTime;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeRemaining, isPaused, soundEnabled, isMyTurn, onTimeExpired]);

  const playSound = (type: 'tick' | 'timeout' | 'warning') => {
    if (!audioRef.current) return;

    // Generate different tones for different sounds
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    switch (type) {
      case 'tick':
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
        break;
      case 'warning':
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.2, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
        break;
      case 'timeout':
        oscillator.frequency.value = 400;
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
        break;
    }

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.5);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (isCritical) return 'text-red-400';
    if (isWarning) return 'text-orange-400';
    return 'text-green-400';
  };

  const getProgressPercentage = () => {
    const maxTime = 120; // 2 minutes default
    return Math.max(0, (timeRemaining / maxTime) * 100);
  };

  return (
    <div className={`glass-card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold">Pick Timer</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title={soundEnabled ? 'Disable sound' : 'Enable sound'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-gray-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          {isPaused && (
            <div className="flex items-center gap-1 text-orange-400">
              <Pause className="w-4 h-4" />
              <span className="text-xs">Paused</span>
            </div>
          )}
        </div>
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={timeRemaining}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`text-4xl font-mono font-bold ${getTimerColor()}`}
          >
            {formatTime(timeRemaining)}
          </motion.div>
        </AnimatePresence>
        
        {isMyTurn && (
          <motion.p
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-sm text-primary-400 mt-1"
          >
            Your turn to pick!
          </motion.p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`absolute left-0 top-0 h-full transition-colors duration-300 ${
            isCritical 
              ? 'bg-red-500' 
              : isWarning 
                ? 'bg-orange-500' 
                : 'bg-green-500'
          }`}
          initial={{ width: '100%' }}
          animate={{ width: `${getProgressPercentage()}%` }}
          transition={{ duration: 0.5 }}
        />
        
        {/* Pulse effect for critical time */}
        {isCritical && (
          <motion.div
            className="absolute inset-0 bg-red-500 opacity-30"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </div>

      {/* Status Messages */}
      <div className="mt-3 text-center">
        {isPaused ? (
          <div className="flex items-center justify-center gap-2 text-orange-400">
            <Pause className="w-4 h-4" />
            <span className="text-sm">Draft is paused</span>
          </div>
        ) : timeRemaining <= 0 ? (
          <div className="flex items-center justify-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Time expired!</span>
          </div>
        ) : isCritical ? (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="flex items-center justify-center gap-2 text-red-400"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-semibold">Time running out!</span>
          </motion.div>
        ) : isWarning ? (
          <div className="flex items-center justify-center gap-2 text-orange-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">30 seconds remaining</span>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {timerUpdate?.currentTeamId === 'my-team' 
              ? 'Make your pick' 
              : `Waiting for ${timerUpdate?.currentTeamId}...`}
          </div>
        )}
      </div>

      {/* Auto-pick indicator */}
      {timerUpdate?.isAutoPick && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 p-2 bg-blue-500/20 border border-blue-500/40 rounded text-center"
        >
          <div className="flex items-center justify-center gap-2 text-blue-400">
            <Play className="w-4 h-4" />
            <span className="text-xs">Auto-pick enabled</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}