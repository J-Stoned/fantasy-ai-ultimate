/**
 * 🎯 TUTORIAL PROVIDER - GLOBAL TUTORIAL STATE
 * 
 * This component provides global tutorial state management and
 * context for the interactive tutorial system.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { InteractiveTutorial, TutorialStep } from './InteractiveTutorial';
import { usePathname } from 'next/navigation';

interface TutorialContextValue {
  startTutorial: (steps?: TutorialStep[]) => void;
  stopTutorial: () => void;
  isTutorialActive: boolean;
  hasCompletedTutorial: boolean;
  resetTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}

interface TutorialProviderProps {
  children: ReactNode;
  autoStartOnFirstVisit?: boolean;
}

export function TutorialProvider({ 
  children, 
  autoStartOnFirstVisit = true 
}: TutorialProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<TutorialStep[] | undefined>();
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false);
  const pathname = usePathname();
  
  // Check if user has completed tutorial
  useEffect(() => {
    const completed = localStorage.getItem('fantasy-ai-tutorial-completed') === 'true';
    const skipped = localStorage.getItem('fantasy-ai-tutorial-skipped') === 'true';
    setHasCompletedTutorial(completed || skipped);
    
    // Auto-start on first visit to dashboard
    if (autoStartOnFirstVisit && !completed && !skipped && pathname === '/dashboard') {
      setTimeout(() => {
        setIsActive(true);
      }, 1000); // Delay for page load
    }
  }, [pathname, autoStartOnFirstVisit]);
  
  const startTutorial = (steps?: TutorialStep[]) => {
    setCurrentSteps(steps);
    setIsActive(true);
  };
  
  const stopTutorial = () => {
    setIsActive(false);
    setCurrentSteps(undefined);
  };
  
  const resetTutorial = () => {
    localStorage.removeItem('fantasy-ai-tutorial-completed');
    localStorage.removeItem('fantasy-ai-tutorial-skipped');
    setHasCompletedTutorial(false);
  };
  
  const handleComplete = () => {
    setIsActive(false);
    setHasCompletedTutorial(true);
    setCurrentSteps(undefined);
  };
  
  const handleSkip = () => {
    setIsActive(false);
    setHasCompletedTutorial(true);
    setCurrentSteps(undefined);
  };
  
  return (
    <TutorialContext.Provider
      value={{
        startTutorial,
        stopTutorial,
        isTutorialActive: isActive,
        hasCompletedTutorial,
        resetTutorial
      }}
    >
      {children}
      {isActive && (
        <InteractiveTutorial
          steps={currentSteps}
          onComplete={handleComplete}
          onSkip={handleSkip}
          autoStart
        />
      )}
    </TutorialContext.Provider>
  );
}

/**
 * 🎯 TUTORIAL PROVIDER FEATURES:
 * 
 * - Global tutorial state
 * - Auto-start on first visit
 * - Persistent completion state
 * - Custom step support
 * - Route-based activation
 * - Reset functionality
 * - Skip tracking
 * 
 * Manage tutorials across your app!
 */