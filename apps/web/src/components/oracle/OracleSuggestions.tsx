/**
 * 💡 ORACLE SUGGESTIONS - QUERY SUGGESTIONS
 * 
 * This component displays contextual query suggestions to help
 * users interact with the Oracle more effectively.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Users, Cloud, DollarSign, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OracleSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

const suggestionIcons: Record<string, React.ReactNode> = {
  'build': <Target className="w-4 h-4" />,
  'compare': <Users className="w-4 h-4" />,
  'weather': <Cloud className="w-4 h-4" />,
  'value': <DollarSign className="w-4 h-4" />,
  'trend': <TrendingUp className="w-4 h-4" />,
  'default': <Sparkles className="w-4 h-4" />
};

export function OracleSuggestions({
  suggestions,
  onSelect,
  className
}: OracleSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }
  
  const getIcon = (suggestion: string) => {
    const lowerSuggestion = suggestion.toLowerCase();
    
    if (lowerSuggestion.includes('build') || lowerSuggestion.includes('lineup')) {
      return suggestionIcons.build;
    }
    if (lowerSuggestion.includes('compare') || lowerSuggestion.includes(' or ') || lowerSuggestion.includes(' vs ')) {
      return suggestionIcons.compare;
    }
    if (lowerSuggestion.includes('weather') || lowerSuggestion.includes('wind')) {
      return suggestionIcons.weather;
    }
    if (lowerSuggestion.includes('value') || lowerSuggestion.includes('salary')) {
      return suggestionIcons.value;
    }
    if (lowerSuggestion.includes('trend') || lowerSuggestion.includes('hot')) {
      return suggestionIcons.trend;
    }
    
    return suggestionIcons.default;
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-gray-400">Suggestions:</p>
      
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(suggestion)}
            className="group relative flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200"
          >
            {/* Icon */}
            <span className="text-gray-400 group-hover:text-white transition-colors">
              {getIcon(suggestion)}
            </span>
            
            {/* Text */}
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              {suggestion}
            </span>
            
            {/* Hover Glow */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-600/0 via-purple-600/10 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </motion.button>
        ))}
      </div>
      
      {/* Quick Actions */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-sm text-gray-400 mb-2">Quick Actions:</p>
        
        <div className="grid grid-cols-3 gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect("Build me a GPP lineup")}
            className="p-2 bg-gradient-to-br from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 rounded-lg transition-all"
          >
            <Target className="w-5 h-5 mx-auto mb-1 text-purple-400" />
            <span className="text-xs text-gray-300">Build Lineup</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect("Show me today's top plays")}
            className="p-2 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 border border-blue-500/30 rounded-lg transition-all"
          >
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <span className="text-xs text-gray-300">Top Plays</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect("What's your prophecy for tonight?")}
            className="p-2 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 border border-indigo-500/30 rounded-lg transition-all"
          >
            <Sparkles className="w-5 h-5 mx-auto mb-1 text-indigo-400" />
            <span className="text-xs text-gray-300">Prophecy</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/**
 * 💡 ORACLE SUGGESTIONS FEATURES:
 * 
 * - Contextual query suggestions
 * - Icon-based visual hints
 * - Quick action buttons
 * - Smooth hover animations
 * - Gradient hover effects
 * - Responsive layout
 * - Category-based icons
 * 
 * Guides users to effective Oracle queries!
 */