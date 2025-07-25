/**
 * 🤖 AI AGENTS PAGE - MULTI-AGENT SYSTEM DASHBOARD
 * 
 * This page showcases all 8 AI specialists and the Fantasy Oracle,
 * allowing users to interact with each agent and view live debates.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Users, Mic, Play, Pause } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  strategy: string;
  specialties: string[];
  color: string;
  gradient: string;
}

const agents: Agent[] = [
  {
    id: 'fantasy-oracle',
    name: 'Fantasy Oracle',
    emoji: '🔮',
    personality: 'All-knowing, balanced, concise, professional',
    strategy: 'Synthesizes insights from all specialists for optimal decisions',
    specialties: ['Master Synthesis', 'Balanced Analysis', 'Prophecies'],
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-indigo-600'
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    emoji: '🤓',
    personality: 'Analytical, precise, evidence-driven',
    strategy: 'Deep statistical analysis and machine learning insights',
    specialties: ['Statistical Analysis', 'ML Predictions', 'Historical Trends'],
    color: 'text-blue-400',
    gradient: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'vegas-sharp',
    name: 'Vegas Sharp',
    emoji: '🎰',
    personality: 'Street-smart, probability-focused, value-seeking',
    strategy: 'Exploits market inefficiencies and betting line movements',
    specialties: ['Betting Lines', 'Ownership Projections', 'Game Theory'],
    color: 'text-red-400',
    gradient: 'from-red-600 to-orange-600'
  },
  {
    id: 'contrarian',
    name: 'Contrarian',
    emoji: '😈',
    personality: 'Bold, unconventional, tournament-winning mindset',
    strategy: 'Finds low-owned gems and tournament leverage spots',
    specialties: ['Low Ownership', 'Tournament Strategy', 'Leverage Spots'],
    color: 'text-amber-400',
    gradient: 'from-amber-600 to-yellow-600'
  },
  {
    id: 'optimizer',
    name: 'Optimizer',
    emoji: '🤖',
    personality: 'Efficient, systematic, process-oriented',
    strategy: 'Maximizes value through algorithmic lineup construction',
    specialties: ['Lineup Building', 'Salary Management', 'Stacking'],
    color: 'text-green-400',
    gradient: 'from-green-600 to-emerald-600'
  },
  {
    id: 'floor-general',
    name: 'Floor General',
    emoji: '🛡️',
    personality: 'Conservative, reliable, consistency-focused',
    strategy: 'Emphasizes safe floor plays for cash game success',
    specialties: ['Cash Games', 'Safe Floors', 'Consistency'],
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-pink-600'
  },
  {
    id: 'narrative-master',
    name: 'Narrative Master',
    emoji: '📖',
    personality: 'Storyteller, psychology expert, narrative builder',
    strategy: 'Identifies emotional edges and revenge game narratives',
    specialties: ['Narratives', 'Revenge Games', 'Motivation'],
    color: 'text-pink-400',
    gradient: 'from-pink-600 to-rose-600'
  },
  {
    id: 'weather-hawk',
    name: 'Weather Hawk',
    emoji: '🌦️',
    personality: 'Environmental specialist, condition analyzer',
    strategy: 'Weather and environmental impact on game outcomes',
    specialties: ['Weather Impact', 'Wind Analysis', 'Field Conditions'],
    color: 'text-sky-400',
    gradient: 'from-sky-600 to-blue-600'
  },
  {
    id: 'chaos-agent',
    name: 'Chaos Agent',
    emoji: '🎲',
    personality: 'Unpredictable, variance-embracing, boom/bust lover',
    strategy: 'Maximum variance plays for tournament upside',
    specialties: ['Boom/Bust', 'Long Shots', 'Volatility'],
    color: 'text-red-500',
    gradient: 'from-red-700 to-red-900'
  }
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isDebateActive, setIsDebateActive] = useState(false);
  const [debateMessages, setDebateMessages] = useState<any[]>([]);
  
  // Simulate live debate messages
  useEffect(() => {
    if (isDebateActive) {
      const interval = setInterval(() => {
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        const messages = [
          "I strongly believe we should fade the chalk QB tonight",
          "The data shows a clear correlation between wind speed and under performance",
          "This is a perfect leverage spot for a contrarian stack",
          "My models project 15% ownership on this play",
          "The narrative is too strong to ignore here"
        ];
        
        setDebateMessages(prev => [...prev, {
          agent: randomAgent,
          message: messages[Math.floor(Math.random() * messages.length)],
          timestamp: new Date()
        }].slice(-5)); // Keep last 5 messages
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isDebateActive]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('/neural-network.svg')] opacity-5" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-3xl" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 border-b border-white/10"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">AI Agent Network</h1>
                <p className="text-gray-400">9 specialized AI personalities for fantasy sports</p>
              </div>
            </div>
            
            <nav className="flex items-center gap-4">
              <Link 
                href="/oracle"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Oracle
              </Link>
              <Link 
                href="/analytics"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Analytics
              </Link>
              <Link 
                href="/dashboard"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </motion.div>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6">
          {/* Agent Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={cn(
                    "bg-white/5 border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer",
                    selectedAgent?.id === agent.id && "border-white/40 bg-white/10"
                  )}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{agent.emoji}</span>
                        <div>
                          <CardTitle className={cn("text-lg", agent.color)}>
                            {agent.name}
                          </CardTitle>
                          {agent.id === 'fantasy-oracle' && (
                            <Badge className="mt-1 bg-purple-600/20 text-purple-400 border-purple-500/30">
                              MASTER
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-300 mb-3">
                      {agent.personality}
                    </p>
                    <p className="text-xs text-gray-400 mb-3 italic">
                      "{agent.strategy}"
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {agent.specialties.map((specialty, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-white/10 rounded-full"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          
          {/* Live Debate Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <CardTitle className="text-white">Live Agent Debate</CardTitle>
                    {isDebateActive && (
                      <Badge className="bg-green-600/20 text-green-400 border-green-500/30">
                        LIVE
                      </Badge>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setIsDebateActive(!isDebateActive)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      isDebateActive 
                        ? "bg-red-600/20 hover:bg-red-600/30 text-red-400"
                        : "bg-green-600/20 hover:bg-green-600/30 text-green-400"
                    )}
                  >
                    {isDebateActive ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {debateMessages.length > 0 ? (
                  <div className="space-y-3">
                    {debateMessages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3"
                      >
                        <span className="text-2xl">{msg.agent.emoji}</span>
                        <div className="flex-1">
                          <p className={cn("text-sm font-medium", msg.agent.color)}>
                            {msg.agent.name}
                          </p>
                          <p className="text-sm text-gray-300">{msg.message}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Mic className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">
                      {isDebateActive 
                        ? "Waiting for agents to speak..." 
                        : "Start a debate to see agents discuss"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Selected Agent Details */}
          {selectedAgent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Card className="bg-gradient-to-br from-white/5 to-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <span className="text-3xl">{selectedAgent.emoji}</span>
                    {selectedAgent.name} Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Personality</h4>
                      <p className="text-white">{selectedAgent.personality}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Strategy</h4>
                      <p className="text-white">{selectedAgent.strategy}</p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Link
                      href="/oracle"
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        "bg-gradient-to-r text-white font-medium",
                        selectedAgent.gradient
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      Summon {selectedAgent.name}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 🤖 AI AGENTS PAGE FEATURES:
 * 
 * - Display all 9 AI agents (including Oracle)
 * - Live debate simulation
 * - Agent selection and details
 * - Beautiful gradient cards
 * - Specialist badges
 * - Navigation to Oracle
 * - Real-time debate messages
 * 
 * Meet the AI specialist team!
 */