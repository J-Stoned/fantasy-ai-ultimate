'use client';

import { motion } from 'framer-motion';
import { 
  Star, 
  TrendingUp, 
  AlertCircle,
  Award,
  Heart,
  Zap
} from 'lucide-react';
import { Player } from '@/lib/services/traditional-fantasy/draft-analysis/types';

interface PlayerCardProps {
  player: Player;
  isRecommended?: boolean;
  isTopPick?: boolean;
  recommendationScore?: number;
  onSelect: () => void;
  isMyTurn?: boolean;
  loading?: boolean;
}

export function PlayerCard({
  player,
  isRecommended = false,
  isTopPick = false,
  recommendationScore = 0,
  onSelect,
  isMyTurn = false,
  loading = false
}: PlayerCardProps) {
  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'RB': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'WR': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'TE': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'K': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'DST': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getInjuryIcon = () => {
    switch (player.injuryStatus) {
      case 'questionable':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'doubtful':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'out':
      case 'ir':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative p-4 rounded-lg border cursor-pointer transition-all
        ${isTopPick ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30' : 
          isRecommended ? 'bg-primary-500/10 border-primary-500/30' : 
          'glass-card hover:border-white/20'}
      `}
      onClick={onSelect}
    >
      {/* Top Pick Badge */}
      {isTopPick && (
        <div className="absolute -top-2 -right-2">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Award className="w-3 h-3" />
            TOP PICK
          </div>
        </div>
      )}

      {/* Recommendation Score */}
      {recommendationScore > 0 && (
        <div className="absolute top-2 left-2">
          <div className={`
            text-xs font-bold px-2 py-1 rounded-full
            ${recommendationScore >= 90 ? 'bg-green-500/20 text-green-400' :
              recommendationScore >= 70 ? 'bg-blue-500/20 text-blue-400' :
              'bg-gray-500/20 text-gray-400'}
          `}>
            {recommendationScore}%
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Player Info */}
        <div>
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold text-sm">{player.name}</h3>
            {getInjuryIcon()}
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`
              text-xs px-2 py-0.5 rounded-full border
              ${getPositionColor(player.position)}
            `}>
              {player.position}
            </span>
            <span className="text-xs text-gray-400">{player.team}</span>
          </div>
        </div>

        {/* Stats Preview */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-gray-500">Age</div>
            <div className="font-semibold">{player.age}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">Exp</div>
            <div className="font-semibold">{player.experience}y</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">Rank</div>
            <div className="font-semibold">#{Math.floor(Math.random() * 200) + 1}</div>
          </div>
        </div>

        {/* Action Button */}
        {isMyTurn && (
          <button
            disabled={loading}
            className={`
              w-full py-2 text-xs font-medium rounded-lg transition-all
              ${isRecommended ? 
                'bg-primary-500 hover:bg-primary-600 text-white' : 
                'bg-gray-800 hover:bg-gray-700 text-gray-300'}
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {loading ? 'Drafting...' : 'Draft Player'}
          </button>
        )}
      </div>

      {/* Recommendation Indicators */}
      {isRecommended && (
        <div className="absolute bottom-2 right-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}