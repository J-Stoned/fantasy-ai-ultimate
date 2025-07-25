'use client';

import { motion } from 'framer-motion';
import { 
  Users, 
  Trophy, 
  TrendingUp, 
  Target,
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { DraftAnalysis } from '@/lib/services/traditional-fantasy/draft-analysis/types';

interface TeamRosterProps {
  team: any; // TeamState type
  analysis: DraftAnalysis | null;
}

export function TeamRoster({ team, analysis }: TeamRosterProps) {
  if (!team) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold">Your Team</h2>
        </div>
        <p className="text-gray-400 text-center py-8">
          No team data available
        </p>
      </div>
    );
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-400';
    if (grade.startsWith('B')) return 'text-blue-400';
    if (grade.startsWith('C')) return 'text-yellow-400';
    if (grade.startsWith('D')) return 'text-orange-400';
    return 'text-red-400';
  };

  const getPositionFillStatus = (need: any) => {
    const percentage = (need.currentCount / need.targetCount) * 100;
    if (percentage >= 100) return { color: 'bg-green-500', status: 'Filled' };
    if (percentage >= 50) return { color: 'bg-yellow-500', status: 'Partial' };
    return { color: 'bg-red-500', status: 'Need' };
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-bold">Your Team</h2>
      </div>

      {/* Team Overview */}
      {analysis && (
        <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className={`text-2xl font-bold ${getGradeColor(analysis.overallGrade)}`}>
                {analysis.overallGrade}
              </div>
              <div className="text-xs text-gray-400">Grade</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-400">
                {analysis.teamStrength.toFixed(0)}
              </div>
              <div className="text-xs text-gray-400">Strength</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                #{analysis.projectedFinish}
              </div>
              <div className="text-xs text-gray-400">Projected</div>
            </div>
          </div>
        </div>
      )}

      {/* Position Needs */}
      <div className="space-y-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-400">Position Needs</h3>
        {team.needs?.map((need: any, index: number) => {
          const { color, status } = getPositionFillStatus(need);
          
          return (
            <motion.div
              key={need.position}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{need.position}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 ${
                    status === 'Filled' ? 'text-green-400' :
                    status === 'Partial' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {status}
                  </span>
                </div>
                <span className="text-gray-400">
                  {need.currentCount}/{need.targetCount}
                </span>
              </div>
              
              <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${color} rounded-full transition-all`}
                  style={{ width: `${Math.min(100, (need.currentCount / need.targetCount) * 100)}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Roster List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">Current Roster ({team.roster?.length || 0})</h3>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {team.roster?.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No players drafted yet
            </p>
          ) : (
            team.roster?.map((playerId: string, index: number) => (
              <motion.div
                key={playerId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="flex items-center justify-between p-2 bg-white/5 rounded text-sm"
              >
                <span>Player {playerId.split('-')[1]}</span>
                <span className="text-gray-400">RB</span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      {analysis && (
        <div className="mt-4 space-y-3">
          {analysis.strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Strengths</h3>
              <div className="space-y-1">
                {analysis.strengths.slice(0, 2).map((strength, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />
                    <span className="text-gray-300">{strength}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {analysis.weaknesses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Weaknesses</h3>
              <div className="space-y-1">
                {analysis.weaknesses.slice(0, 2).map((weakness, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="w-3 h-3 text-yellow-400 mt-0.5" />
                    <span className="text-gray-300">{weakness}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}