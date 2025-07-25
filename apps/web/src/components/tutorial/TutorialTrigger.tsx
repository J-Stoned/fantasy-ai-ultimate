/**
 * 🎮 TUTORIAL TRIGGER - HELP BUTTON
 * 
 * This component provides a help button that triggers the tutorial
 * and can be placed anywhere in the app.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Play, RotateCcw, X } from 'lucide-react';
import { useTutorial } from './TutorialProvider';
import { cn } from '@/lib/utils';
import { TutorialStep } from './InteractiveTutorial';

interface TutorialTriggerProps {
  steps?: TutorialStep[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

export function TutorialTrigger({ 
  steps,
  position = 'bottom-right',
  className 
}: TutorialTriggerProps) {
  const { startTutorial, hasCompletedTutorial, resetTutorial } = useTutorial();
  const [showMenu, setShowMenu] = useState(false);
  
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };
  
  const menuPositionClasses = {
    'bottom-right': 'bottom-full right-0 mb-2',
    'bottom-left': 'bottom-full left-0 mb-2',
    'top-right': 'top-full right-0 mt-2',
    'top-left': 'top-full left-0 mt-2'
  };
  
  const handleStartTutorial = () => {
    startTutorial(steps);
    setShowMenu(false);
  };
  
  const handleResetTutorial = () => {
    resetTutorial();
    startTutorial(steps);
    setShowMenu(false);
  };
  
  return (
    <div className={cn(
      "fixed z-50",
      positionClasses[position],
      className
    )}>
      <div className="relative">
        {/* Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className={cn(
                "absolute w-48 bg-black/90 backdrop-blur-xl rounded-xl border border-purple-500/30 p-2",
                menuPositionClasses[position]
              )}
            >
              <button
                onClick={handleStartTutorial}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <Play className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {hasCompletedTutorial ? 'Review Tutorial' : 'Start Tutorial'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Learn all features
                  </p>
                </div>
              </button>
              
              {hasCompletedTutorial && (
                <button
                  onClick={handleResetTutorial}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                >
                  <RotateCcw className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Reset Tutorial
                    </p>
                    <p className="text-xs text-gray-400">
                      Start from beginning
                    </p>
                  </div>
                </button>
              )}
              
              <div className="border-t border-white/10 mt-2 pt-2">
                <a
                  href="/help"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                >
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Help Center
                    </p>
                    <p className="text-xs text-gray-400">
                      Docs & support
                    </p>
                  </div>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Trigger Button */}
        <motion.button
          onClick={() => setShowMenu(!showMenu)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full",
            "shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all",
            "group"
          )}
        >
          {showMenu ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <HelpCircle className="w-6 h-6 text-white" />
          )}
          
          {/* Pulse animation for first-time users */}
          {!hasCompletedTutorial && !showMenu && (
            <>
              <span className="absolute inset-0 rounded-full bg-purple-600 animate-ping opacity-20" />
              <span className="absolute inset-0 rounded-full bg-purple-600 animate-ping opacity-10 animation-delay-200" />
            </>
          )}
          
          {/* Tooltip */}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {hasCompletedTutorial ? 'Help & Tutorial' : 'Start Tutorial'}
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}

/**
 * 🎮 TUTORIAL TRIGGER FEATURES:
 * 
 * - Floating help button
 * - Tutorial start/restart
 * - Help center link
 * - Position options
 * - Pulse animation
 * - Completion tracking
 * - Beautiful design
 * 
 * Help is always one click away!
 */