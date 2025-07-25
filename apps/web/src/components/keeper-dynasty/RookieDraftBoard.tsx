'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  StarIcon,
  TrendingUpIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ChartBarIcon,
  FireIcon,
  AcademicCapIcon,
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Radar, Bar } from 'react-chartjs-2';
import type { TeamMetrics, LeagueContext } from '@/lib/services/traditional-fantasy/keeper-management/types';

interface RookieDraftBoardProps {
  teamMetrics: TeamMetrics;
  leagueContext: LeagueContext;
}

interface RookieProspect {
  id: string;
  name: string;
  position: string;
  school: string;
  age: number;
  athleticism: number; // 0-100
  production: number; // 0-100
  character: number; // 0-100
  injuryHistory: string[];
  projectedRound: number;
  ceilingScore: number; // 0-100
  floorScore: number; // 0-100
  bustProbability: number; // 0-1
  comparisons: string[];
  strengths: string[];
  weaknesses: string[];
  fantasyProjection: {
    year1: number;
    year2: number;
    year3: number;
    peak: number;
  };
}

// Mock rookie data - in production would come from scouting service
const mockRookies: RookieProspect[] = [
  {
    id: '1',
    name: 'Marvin Harrison Jr.',
    position: 'WR',
    school: 'Ohio State',
    age: 21,
    athleticism: 92,
    production: 95,
    character: 90,
    injuryHistory: [],
    projectedRound: 1,
    ceilingScore: 95,
    floorScore: 75,
    bustProbability: 0.15,
    comparisons: ['AJ Green', 'Mike Evans'],
    strengths: ['Elite route running', 'Strong hands', 'Red zone threat'],
    weaknesses: ['Limited YAC ability', 'Needs to improve blocking'],
    fantasyProjection: {
      year1: 180,
      year2: 240,
      year3: 280,
      peak: 320
    }
  },
  {
    id: '2',
    name: 'Bijan Robinson',
    position: 'RB',
    school: 'Texas',
    age: 21,
    athleticism: 94,
    production: 96,
    character: 95,
    injuryHistory: [],
    projectedRound: 1,
    ceilingScore: 98,
    floorScore: 80,
    bustProbability: 0.12,
    comparisons: ['Saquon Barkley', 'LaDainian Tomlinson'],
    strengths: ['Elite vision', 'Receiving ability', 'Breakaway speed'],
    weaknesses: ['Workload concerns', 'Pass protection'],
    fantasyProjection: {
      year1: 220,
      year2: 280,
      year3: 300,
      peak: 350
    }
  },
  {
    id: '3',
    name: 'Rome Odunze',
    position: 'WR',
    school: 'Washington',
    age: 21,
    athleticism: 88,
    production: 92,
    character: 88,
    injuryHistory: [],
    projectedRound: 1,
    ceilingScore: 90,
    floorScore: 70,
    bustProbability: 0.20,
    comparisons: ['Chris Olave', 'Keenan Allen'],
    strengths: ['Contested catches', 'Route precision', 'Football IQ'],
    weaknesses: ['Average speed', 'Needs strength'],
    fantasyProjection: {
      year1: 160,
      year2: 210,
      year3: 250,
      peak: 290
    }
  }
];

export function RookieDraftBoard({ teamMetrics, leagueContext }: RookieDraftBoardProps) {
  const [selectedProspect, setSelectedProspect] = useState<RookieProspect | null>(null);
  const [filterPosition, setFilterPosition] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'ceiling' | 'floor' | 'adp' | 'value'>('adp');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonProspects, setComparisonProspects] = useState<RookieProspect[]>([]);

  // Filter and sort prospects
  const displayedProspects = useMemo(() => {
    let prospects = [...mockRookies];
    
    if (filterPosition !== 'ALL') {
      prospects = prospects.filter(p => p.position === filterPosition);
    }
    
    switch (sortBy) {
      case 'ceiling':
        return prospects.sort((a, b) => b.ceilingScore - a.ceilingScore);
      case 'floor':
        return prospects.sort((a, b) => b.floorScore - a.floorScore);
      case 'value':
        return prospects.sort((a, b) => {
          const aValue = (a.ceilingScore + a.floorScore) / 2;
          const bValue = (b.ceilingScore + b.floorScore) / 2;
          return bValue - aValue;
        });
      default:
        return prospects.sort((a, b) => a.projectedRound - b.projectedRound);
    }
  }, [filterPosition, sortBy]);

  // Calculate draft capital value
  const draftCapitalValue = useMemo(() => {
    return teamMetrics.draftCapital.reduce((sum, pick) => sum + pick.expectedValue, 0);
  }, [teamMetrics]);

  const getGradeColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const toggleComparison = (prospect: RookieProspect) => {
    if (comparisonProspects.find(p => p.id === prospect.id)) {
      setComparisonProspects(prev => prev.filter(p => p.id !== prospect.id));
    } else if (comparisonProspects.length < 3) {
      setComparisonProspects(prev => [...prev, prospect]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Draft Capital Overview */}
      <Card className="bg-gradient-to-br from-blue-900/20 to-gray-900 border-blue-500/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Rookie Draft Board</h2>
              <p className="text-gray-400">AI-powered prospect evaluation</p>
            </div>
          </div>
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <p className="text-sm text-gray-400">Draft Capital Value</p>
            <p className="text-3xl font-bold text-blue-400">{draftCapitalValue}</p>
          </motion.div>
        </div>

        {/* Your Picks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {teamMetrics.draftCapital.map((pick, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.05 }}
              className="bg-gray-800/50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-white">
                  Round {pick.round} Pick
                </h4>
                <span className="text-xs px-2 py-1 bg-blue-500/20 rounded text-blue-400">
                  #{pick.round * 12 - 6} Overall
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Value</p>
                  <p className="font-semibold text-white">{pick.expectedValue}</p>
                </div>
                <div>
                  <p className="text-gray-500">Star Rate</p>
                  <p className="font-semibold text-green-400">{(pick.starRate * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {Object.entries(pick.positionProbability).map(([pos, prob]) => (
                  <span key={pos} className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300">
                    {pos} {(prob * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {['ALL', 'RB', 'WR', 'QB', 'TE'].map(pos => (
              <button
                key={pos}
                onClick={() => setFilterPosition(pos)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filterPosition === pos
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                showComparison
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Compare ({comparisonProspects.length})
            </button>
            {['adp', 'ceiling', 'floor', 'value'].map(sort => (
              <button
                key={sort}
                onClick={() => setSortBy(sort as any)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  sortBy === sort
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {sort.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Prospect List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayedProspects.map((prospect, idx) => (
          <motion.div
            key={prospect.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card 
              className={`bg-gray-800/50 border-gray-700 p-4 cursor-pointer transition-all hover:border-blue-500/50 ${
                selectedProspect?.id === prospect.id ? 'border-blue-500' : ''
              }`}
              onClick={() => setSelectedProspect(prospect)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                    <AcademicCapIcon className="w-6 h-6 text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{prospect.name}</h3>
                    <p className="text-sm text-gray-400">
                      {prospect.position} • {prospect.school} • Age {prospect.age}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleComparison(prospect);
                    }}
                    className={`p-1 rounded transition-colors ${
                      comparisonProspects.find(p => p.id === prospect.id)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    <ChartBarIcon className="w-4 h-4" />
                  </button>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Grade</p>
                    <p className={`text-lg font-bold ${getGradeColor((prospect.ceilingScore + prospect.floorScore) / 2)}`}>
                      {getGrade((prospect.ceilingScore + prospect.floorScore) / 2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Ceiling</p>
                  <p className={`text-sm font-bold ${getGradeColor(prospect.ceilingScore)}`}>
                    {prospect.ceilingScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Floor</p>
                  <p className={`text-sm font-bold ${getGradeColor(prospect.floorScore)}`}>
                    {prospect.floorScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Bust %</p>
                  <p className={`text-sm font-bold ${
                    prospect.bustProbability < 0.2 ? 'text-green-400' :
                    prospect.bustProbability < 0.3 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(prospect.bustProbability * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <StarIcon className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-gray-400">
                  Comps: {prospect.comparisons.join(', ')}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-gray-900/50 rounded px-2 py-1 text-center">
                  <p className="text-gray-500">Y1</p>
                  <p className="text-white font-semibold">{prospect.fantasyProjection.year1}</p>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1 text-center">
                  <p className="text-gray-500">Y2</p>
                  <p className="text-white font-semibold">{prospect.fantasyProjection.year2}</p>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1 text-center">
                  <p className="text-gray-500">Y3</p>
                  <p className="text-white font-semibold">{prospect.fantasyProjection.year3}</p>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1 text-center">
                  <p className="text-gray-500">Peak</p>
                  <p className="text-yellow-400 font-semibold">{prospect.fantasyProjection.peak}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Detailed Prospect View */}
      <AnimatePresence>
        {selectedProspect && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{selectedProspect.name}</h3>
                  <p className="text-gray-400">
                    {selectedProspect.position} • {selectedProspect.school} • Projected Round {selectedProspect.projectedRound}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attributes Radar */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-4">Player Attributes</h4>
                  <div className="h-64">
                    <Radar
                      data={{
                        labels: ['Athleticism', 'Production', 'Character'],
                        datasets: [{
                          label: selectedProspect.name,
                          data: [
                            selectedProspect.athleticism,
                            selectedProspect.production,
                            selectedProspect.character
                          ],
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          borderColor: 'rgb(59, 130, 246)',
                          pointBackgroundColor: 'rgb(59, 130, 246)',
                          pointBorderColor: '#fff',
                          pointHoverBackgroundColor: '#fff',
                          pointHoverBorderColor: 'rgb(59, 130, 246)'
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { color: 'rgba(255, 255, 255, 0.6)' },
                            ticks: { 
                              color: 'rgba(255, 255, 255, 0.6)',
                              beginAtZero: true,
                              max: 100
                            }
                          }
                        },
                        plugins: { legend: { display: false } }
                      }}
                    />
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="space-y-4">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-green-400" />
                      Strengths
                    </h4>
                    <ul className="space-y-1">
                      {selectedProspect.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                          <BoltIcon className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />
                      Weaknesses
                    </h4>
                    <ul className="space-y-1">
                      {selectedProspect.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                          <ExclamationTriangleIcon className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedProspect.injuryHistory.length > 0 && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-red-400 mb-2">Injury History</h4>
                      <ul className="space-y-1">
                        {selectedProspect.injuryHistory.map((injury, idx) => (
                          <li key={idx} className="text-sm text-red-300">{injury}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Fantasy Projection */}
              <div className="mt-6 bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-purple-400" />
                  AI Fantasy Projection
                </h4>
                <div className="h-48">
                  <Bar
                    data={{
                      labels: ['Year 1', 'Year 2', 'Year 3', 'Peak'],
                      datasets: [{
                        label: 'Projected Points',
                        data: [
                          selectedProspect.fantasyProjection.year1,
                          selectedProspect.fantasyProjection.year2,
                          selectedProspect.fantasyProjection.year3,
                          selectedProspect.fantasyProjection.peak
                        ],
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(59, 130, 246, 0.6)',
                          'rgba(59, 130, 246, 0.4)',
                          'rgba(251, 191, 36, 0.8)'
                        ]
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { 
                          grid: { color: 'rgba(255, 255, 255, 0.1)' },
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                        },
                        y: { 
                          grid: { color: 'rgba(255, 255, 255, 0.1)' },
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison View */}
      <AnimatePresence>
        {showComparison && comparisonProspects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Prospect Comparison</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-sm text-gray-400 pb-2">Metric</th>
                      {comparisonProspects.map(p => (
                        <th key={p.id} className="text-center text-sm text-gray-400 pb-2">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 text-sm text-gray-400">Position</td>
                      {comparisonProspects.map(p => (
                        <td key={p.id} className="text-center text-sm text-white">
                          {p.position}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 text-sm text-gray-400">Age</td>
                      {comparisonProspects.map(p => (
                        <td key={p.id} className="text-center text-sm text-white">
                          {p.age}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 text-sm text-gray-400">Ceiling</td>
                      {comparisonProspects.map(p => (
                        <td key={p.id} className={`text-center text-sm font-bold ${getGradeColor(p.ceilingScore)}`}>
                          {p.ceilingScore}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 text-sm text-gray-400">Floor</td>
                      {comparisonProspects.map(p => (
                        <td key={p.id} className={`text-center text-sm font-bold ${getGradeColor(p.floorScore)}`}>
                          {p.floorScore}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 text-sm text-gray-400">Bust %</td>
                      {comparisonProspects.map(p => (
                        <td key={p.id} className={`text-center text-sm font-bold ${
                          p.bustProbability < 0.2 ? 'text-green-400' :
                          p.bustProbability < 0.3 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {(p.bustProbability * 100).toFixed(0)}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-sm text-gray-400">Year 1 Projection</td>
                      {comparisonProspects.map(p => (
                        <td key={p.id} className="text-center text-sm text-white font-bold">
                          {p.fantasyProjection.year1}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setComparisonProspects([])}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  Clear Comparison
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}