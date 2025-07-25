/**
 * 🎯 SPECIALIST PANEL - AI SPECIALIST SELECTION
 * 
 * This component displays available AI specialists and allows
 * users to summon specific experts for targeted advice.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface Specialist {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  strategy: string;
  specialties: string[];
  availability?: 'available' | 'busy' | 'offline';
}

interface SpecialistPanelProps {
  specialists: Specialist[];
  currentSpecialist?: string;
  onSummon: (specialistId: string) => void;
  className?: string;
}

export function SpecialistPanel({
  specialists,
  currentSpecialist,
  onSummon,
  className
}: SpecialistPanelProps) {
  const getSpecialistColor = (id: string) => {
    const colors: Record<string, string> = {
      'data-scientist': 'from-blue-600 to-blue-800',
      'vegas-sharp': 'from-red-600 to-red-800',
      'contrarian': 'from-amber-600 to-amber-800',
      'optimizer': 'from-green-600 to-green-800',
      'floor-general': 'from-purple-600 to-purple-800',
      'narrative-master': 'from-pink-600 to-pink-800',
      'weather-hawk': 'from-sky-600 to-sky-800',
      'chaos-agent': 'from-red-700 to-red-900'
    };
    return colors[id] || 'from-gray-600 to-gray-800';
  };
  
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">AI Specialists</h3>
        <span className="text-sm text-gray-400">
          {specialists.filter(s => s.availability === 'available').length} available
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {specialists.map((specialist, index) => {
          const isActive = specialist.id === currentSpecialist;
          const isAvailable = specialist.availability === 'available';
          
          return (
            <motion.button
              key={specialist.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => isAvailable && onSummon(specialist.id)}
              disabled={!isAvailable || isActive}
              className={cn(
                "relative group p-4 rounded-xl border transition-all duration-300",
                isActive
                  ? "bg-gradient-to-br border-white/30 shadow-lg scale-105"
                  : isAvailable
                  ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105"
                  : "bg-white/5 border-white/5 opacity-50 cursor-not-allowed",
                isActive && getSpecialistColor(specialist.id)
              )}
            >
              {/* Background Gradient */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br opacity-20" />
              )}
              
              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{specialist.emoji}</span>
                  <div className="text-left">
                    <h4 className="font-medium text-white">
                      {specialist.name}
                    </h4>
                    <p className="text-xs text-gray-400 line-clamp-1">
                      {specialist.personality}
                    </p>
                  </div>
                </div>
                
                {/* Strategy */}
                <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                  {specialist.strategy}
                </p>
                
                {/* Specialties */}
                <div className="flex flex-wrap gap-1">
                  {specialist.specialties.slice(0, 3).map((specialty, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs bg-white/10 rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                  {specialist.specialties.length > 3 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{specialist.specialties.length - 3}
                    </span>
                  )}
                </div>
                
                {/* Status Indicator */}
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
              
              {/* Hover Effect */}
              {isAvailable && !isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" 
                     style={{
                       backgroundImage: `linear-gradient(to bottom right, ${getSpecialistColor(specialist.id).split(' ')[1]}, ${getSpecialistColor(specialist.id).split(' ')[3]})`
                     }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
      
      {/* Oracle Return Button */}
      {currentSpecialist && currentSpecialist !== 'oracle' && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onSummon('oracle')}
          className="w-full p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <span className="text-lg">🔮</span>
          <span className="text-white font-medium">Return to Oracle</span>
        </motion.button>
      )}
    </div>
  );
}

/**
 * 🎯 SPECIALIST PANEL FEATURES:
 * 
 * - Grid layout of available specialists
 * - Visual indicators for active specialist
 * - Availability status display
 * - Specialty tags for each expert
 * - Smooth hover animations
 * - Gradient backgrounds for active state
 * - Return to Oracle button
 * - Responsive design
 * 
 * Easy access to specialized AI expertise!
 */