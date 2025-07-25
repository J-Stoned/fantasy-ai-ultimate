/**
 * 🎯 MOBILE AGENT SELECTOR - QUICK AGENT SELECTION
 * 
 * This component provides a compact agent selector for mobile
 * interfaces with horizontal scrolling and quick access.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  color: string;
  gradient: string;
}

interface MobileAgentSelectorProps {
  agents: Agent[];
  selectedAgentId?: string;
  onAgentSelect: (agent: Agent) => void;
  className?: string;
  showOracle?: boolean;
}

export function MobileAgentSelector({
  agents,
  selectedAgentId,
  onAgentSelect,
  className,
  showOracle = true
}: MobileAgentSelectorProps) {
  // Filter to show Oracle first if enabled
  const sortedAgents = showOracle 
    ? [...agents].sort((a, b) => {
        if (a.id === 'fantasy-oracle') return -1;
        if (b.id === 'fantasy-oracle') return 1;
        return 0;
      })
    : agents;
  
  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-4">
        <h4 className="text-sm font-medium text-white">Select Agent</h4>
        <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 text-xs">
          {agents.length} AI
        </Badge>
      </div>
      
      {/* Scrollable Agent List */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2">
        {sortedAgents.map((agent, index) => (
          <motion.button
            key={agent.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onAgentSelect(agent)}
            className={cn(
              "flex-shrink-0 p-3 rounded-xl border transition-all",
              selectedAgentId === agent.id
                ? "bg-gradient-to-br border-white/30"
                : "bg-white/5 border-white/10 hover:border-white/20",
              selectedAgentId === agent.id && agent.gradient
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{agent.emoji}</span>
              <div className="text-left">
                <p className={cn(
                  "text-sm font-medium",
                  selectedAgentId === agent.id ? "text-white" : "text-gray-200"
                )}>
                  {agent.name}
                </p>
                {agent.id === 'fantasy-oracle' && (
                  <Badge className="mt-0.5 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                    Master
                  </Badge>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
      
      {/* Selected Agent Details */}
      {selectedAgentId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 mx-4 p-3 bg-white/5 rounded-lg border border-white/10"
        >
          {(() => {
            const selected = agents.find(a => a.id === selectedAgentId);
            if (!selected) return null;
            
            return (
              <div className="flex items-start gap-2">
                <span className="text-xl">{selected.emoji}</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-300">
                    {selected.personality}
                  </p>
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}

/**
 * 🎯 MOBILE AGENT SELECTOR FEATURES:
 * 
 * - Horizontal scrolling agent list
 * - Oracle prioritization option
 * - Selected agent details
 * - Touch-friendly design
 * - Smooth animations
 * - Compact layout
 * - Visual selection state
 * 
 * Quick agent selection on mobile!
 */