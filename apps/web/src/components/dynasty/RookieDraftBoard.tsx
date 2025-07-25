'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { FiUser, FiTrendingUp, FiStar, FiMove, FiSearch, FiFilter } from 'react-icons/fi';
import { rookieDraftService } from '@/lib/services/traditional-fantasy/keeper-management/rookie-draft-service';
import type { RookieProspect } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

interface RookieDraftBoardProps {
  leagueId: string;
  teamId: string;
}

export const RookieDraftBoard: React.FC<RookieDraftBoardProps> = ({
  leagueId,
  teamId
}) => {
  const [prospects, setProspects] = useState<RookieProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedProspect, setSelectedProspect] = useState<RookieProspect | null>(null);

  useEffect(() => {
    loadProspects();
  }, [leagueId]);

  const loadProspects = async () => {
    setLoading(true);
    try {
      const data = await rookieDraftService.getRookieProspects(leagueId);
      setProspects(data);
    } catch (error) {
      logger.error('Failed to load prospects:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (newOrder: RookieProspect[]) => {
    setProspects(newOrder);
    // Save new order to backend
    rookieDraftService.updateDraftBoard(leagueId, teamId, newOrder.map(p => p.id));
  };

  const filteredProspects = prospects.filter(prospect => {
    const matchesSearch = prospect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         prospect.college.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = positionFilter === 'all' || prospect.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  const getGradeColor = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'text-green-400';
    if (grade === 'B+' || grade === 'B') return 'text-blue-400';
    if (grade === 'C+' || grade === 'C') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getTierColor = (tier: number) => {
    if (tier === 1) return 'from-purple-500 to-pink-500';
    if (tier === 2) return 'from-blue-500 to-cyan-500';
    if (tier === 3) return 'from-green-500 to-emerald-500';
    if (tier === 4) return 'from-yellow-500 to-orange-500';
    return 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700/50 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-700/50 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Rookie Draft Board</h2>
            <p className="text-gray-400">Rank and track incoming rookies</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'board' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search prospects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-gray-800/50 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
          >
            <option value="all">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
          </select>
        </div>
      </motion.div>

      {/* Draft Board */}
      {viewMode === 'board' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <Reorder.Group
            axis="y"
            values={filteredProspects}
            onReorder={handleReorder}
            className="space-y-3"
          >
            <AnimatePresence>
              {filteredProspects.map((prospect, index) => (
                <Reorder.Item
                  key={prospect.id}
                  value={prospect}
                  className="cursor-move"
                >
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedProspect(prospect)}
                    className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-700/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 text-white font-bold">
                          {index + 1}
                        </div>
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getTierColor(prospect.tier)} flex items-center justify-center`}>
                          <FiUser className="text-white text-xl" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{prospect.name}</h4>
                          <div className="flex items-center space-x-3 text-sm text-gray-400">
                            <span>{prospect.position}</span>
                            <span>•</span>
                            <span>{prospect.college}</span>
                            <span>•</span>
                            <span>Tier {prospect.tier}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className={`text-2xl font-bold ${getGradeColor(prospect.grade)}`}>
                            {prospect.grade}
                          </p>
                          <p className="text-xs text-gray-400">Grade</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {prospect.adp}
                          </p>
                          <p className="text-xs text-gray-400">ADP</p>
                        </div>
                        <FiMove className="text-gray-500" />
                      </div>
                    </div>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Position</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">College</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Grade</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">ADP</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Tier</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspects.map((prospect, index) => (
                  <motion.tr
                    key={prospect.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedProspect(prospect)}
                    className="border-b border-gray-800 hover:bg-gray-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-white font-medium">{index + 1}</td>
                    <td className="py-3 px-4 text-white">{prospect.name}</td>
                    <td className="py-3 px-4 text-gray-400">{prospect.position}</td>
                    <td className="py-3 px-4 text-gray-400">{prospect.college}</td>
                    <td className={`py-3 px-4 text-center font-bold ${getGradeColor(prospect.grade)}`}>
                      {prospect.grade}
                    </td>
                    <td className="py-3 px-4 text-center text-white">{prospect.adp}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${getTierColor(prospect.tier)}`}>
                        Tier {prospect.tier}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Prospect Detail Modal */}
      <AnimatePresence>
        {selectedProspect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedProspect(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-2xl w-full rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{selectedProspect.name}</h3>
                  <div className="flex items-center space-x-3 text-gray-400">
                    <span>{selectedProspect.position}</span>
                    <span>•</span>
                    <span>{selectedProspect.college}</span>
                    <span>•</span>
                    <span>{selectedProspect.height} / {selectedProspect.weight} lbs</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Draft Grade</p>
                  <p className={`text-3xl font-bold ${getGradeColor(selectedProspect.grade)}`}>
                    {selectedProspect.grade}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">NFL Comparison</p>
                  <p className="text-lg font-medium text-white">
                    {selectedProspect.nflComparison}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Fantasy Projection</p>
                  <p className="text-lg font-medium text-white">
                    {selectedProspect.projectedPoints} pts
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-medium text-white mb-2">Strengths</h4>
                  <ul className="space-y-1">
                    {selectedProspect.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-white mb-2">Concerns</h4>
                  <ul className="space-y-1">
                    {selectedProspect.concerns.map((concern, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start">
                        <span className="text-red-400 mr-2">•</span>
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};