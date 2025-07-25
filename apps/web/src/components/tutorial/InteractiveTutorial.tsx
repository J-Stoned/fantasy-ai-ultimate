/**
 * 🎓 INTERACTIVE TUTORIAL - ONBOARDING EXCELLENCE
 * 
 * This component provides an interactive tutorial system that guides
 * users through all features with tooltips, highlights, and step-by-step
 * instructions.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, Sparkles, 
  Mic, Brain, BarChart3, MessageCircle, CheckCircle,
  Play, SkipForward
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
  icon?: React.ReactNode;
  tips?: string[];
}

interface InteractiveTutorialProps {
  steps: TutorialStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
  className?: string;
}

const defaultSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Fantasy.AI Ultimate! 🚀',
    description: 'The most advanced fantasy sports platform powered by AI. Let me show you around!',
    icon: <Sparkles className="w-6 h-6" />,
    tips: [
      '9 AI agents to help you win',
      'Voice-controlled analytics',
      'ML-powered predictions',
      'Real-time insights'
    ]
  },
  {
    id: 'oracle',
    title: 'Meet the Fantasy Oracle 🔮',
    description: 'Your master AI advisor that combines insights from all 8 specialist agents. Just say "Hey Fantasy" to activate!',
    target: '.oracle-interface',
    position: 'left',
    icon: <span className="text-2xl">🔮</span>,
    tips: [
      'Say "Hey Fantasy" to activate',
      'Ask for lineup advice',
      'Get consensus from all agents',
      'Voice-controlled for convenience'
    ]
  },
  {
    id: 'voice-analytics',
    title: 'Voice Analytics Dashboard 🎙️',
    description: 'Ask questions about your data in natural language and get instant visualizations!',
    target: '.voice-analytics',
    position: 'top',
    icon: <Mic className="w-6 h-6" />,
    tips: [
      'Ask "Show me QB scoring trends"',
      'Try "Compare top 5 RBs"',
      'Say "Weather impact analysis"',
      'Charts generated instantly'
    ]
  },
  {
    id: 'ai-agents',
    title: '9 Specialized AI Agents 🤖',
    description: 'Each agent has unique expertise: Data Scientist, Vegas Sharp, Contrarian, and more!',
    target: '.agent-selector',
    position: 'bottom',
    icon: <Brain className="w-6 h-6" />,
    tips: [
      'Data Scientist: Statistical analysis',
      'Vegas Sharp: Betting insights',
      'Contrarian: Tournament leverage',
      'Weather Hawk: Environmental factors'
    ]
  },
  {
    id: 'ml-predictions',
    title: 'ML-Powered Predictions 🧠',
    description: 'Our models achieve 96.97% NFL accuracy! Access predictions for all major sports.',
    target: '.ml-dashboard',
    position: 'right',
    icon: <BarChart3 className="w-6 h-6" />,
    tips: [
      '96.97% NFL prediction accuracy',
      '4.3M+ training records',
      'GPU-accelerated processing',
      'Real-time model updates'
    ]
  },
  {
    id: 'mobile-experience',
    title: 'Optimized for Mobile 📱',
    description: 'Everything works perfectly on mobile with touch-friendly interfaces and voice control.',
    icon: <MessageCircle className="w-6 h-6" />,
    tips: [
      'Swipe between agents',
      'Tab-based navigation',
      'Voice input anywhere',
      'One-handed operation'
    ]
  },
  {
    id: 'get-started',
    title: "Let's Get Started! 🎯",
    description: "You're all set! Try asking the Oracle for advice or explore the voice analytics.",
    icon: <CheckCircle className="w-6 h-6" />,
    tips: [
      'Say "Hey Fantasy" anytime',
      'Explore all 9 AI agents',
      'Ask analytics questions',
      'Win more contests!'
    ]
  }
];

export function InteractiveTutorial({
  steps = defaultSteps,
  onComplete,
  onSkip,
  autoStart = true,
  className
}: InteractiveTutorialProps) {
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  
  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  
  // Update highlight position
  useEffect(() => {
    if (currentStepData?.target) {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  }, [currentStep, currentStepData]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep]);
  
  const handleNext = useCallback(() => {
    setHasInteracted(true);
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      currentStepData?.action?.();
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length, currentStepData]);
  
  const handlePrevious = useCallback(() => {
    setHasInteracted(true);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);
  
  const handleComplete = useCallback(() => {
    setIsActive(false);
    onComplete?.();
    // Save tutorial completion
    localStorage.setItem('fantasy-ai-tutorial-completed', 'true');
  }, [onComplete]);
  
  const handleSkip = useCallback(() => {
    setIsActive(false);
    onSkip?.();
    localStorage.setItem('fantasy-ai-tutorial-skipped', 'true');
  }, [onSkip]);
  
  const getTooltipPosition = () => {
    if (!highlightRect || !currentStepData?.position) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    
    const spacing = 20;
    const positions = {
      top: {
        bottom: `${window.innerHeight - highlightRect.top + spacing}px`,
        left: `${highlightRect.left + highlightRect.width / 2}px`,
        transform: 'translateX(-50%)'
      },
      bottom: {
        top: `${highlightRect.bottom + spacing}px`,
        left: `${highlightRect.left + highlightRect.width / 2}px`,
        transform: 'translateX(-50%)'
      },
      left: {
        top: `${highlightRect.top + highlightRect.height / 2}px`,
        right: `${window.innerWidth - highlightRect.left + spacing}px`,
        transform: 'translateY(-50%)'
      },
      right: {
        top: `${highlightRect.top + highlightRect.height / 2}px`,
        left: `${highlightRect.right + spacing}px`,
        transform: 'translateY(-50%)'
      }
    };
    
    return positions[currentStepData.position];
  };
  
  if (!isActive) return null;
  
  return (
    <div className={cn("fixed inset-0 z-[100]", className)}>
      {/* Backdrop with highlight cutout */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        {highlightRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bg-transparent border-4 border-purple-500 rounded-xl shadow-[0_0_40px_rgba(147,51,234,0.5)]"
            style={{
              top: highlightRect.top - 8,
              left: highlightRect.left - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16
            }}
          />
        )}
      </div>
      
      {/* Tutorial Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="absolute max-w-md"
          style={getTooltipPosition()}
        >
          <Card className="bg-black/90 backdrop-blur-xl border-purple-500/30 shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {currentStepData.icon && (
                    <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
                      {currentStepData.icon}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-white">
                      {currentStepData.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                />
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-gray-300 mb-4">
                {currentStepData.description}
              </p>
              
              {/* Tips */}
              {currentStepData.tips && currentStepData.tips.length > 0 && (
                <div className="mb-4 space-y-2">
                  {currentStepData.tips.map((tip, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2"
                    >
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-gray-400">{tip}</p>
                    </motion.div>
                  ))}
                </div>
              )}
              
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all",
                    currentStep === 0
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSkip}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Skip Tour
                  </button>
                  
                  {currentStep === steps.length - 1 ? (
                    <button
                      onClick={handleComplete}
                      className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-medium text-white hover:from-purple-700 hover:to-blue-700 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Get Started
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white transition-all"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
          
          {/* Pulse animation for highlighted element */}
          {highlightRect && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: highlightRect.top - 12,
                left: highlightRect.left - 12,
                width: highlightRect.width + 24,
                height: highlightRect.height + 24
              }}
            >
              <div className="absolute inset-0 border-2 border-purple-500 rounded-xl animate-ping opacity-30" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Quick restart button */}
      {!hasInteracted && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={() => setIsActive(true)}
          className="absolute bottom-6 left-6 flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg text-sm text-purple-400 transition-all"
        >
          <Play className="w-4 h-4" />
          Restart Tutorial
        </motion.button>
      )}
    </div>
  );
}

/**
 * 🎓 INTERACTIVE TUTORIAL FEATURES:
 * 
 * - Step-by-step guidance
 * - Element highlighting
 * - Progress tracking
 * - Keyboard navigation
 * - Mobile-friendly
 * - Skip functionality
 * - Tips and tricks
 * - Beautiful animations
 * - Persistent state
 * - Customizable steps
 * 
 * The perfect onboarding experience!
 */