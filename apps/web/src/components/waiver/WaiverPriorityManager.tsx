'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  ArrowUp, 
  ArrowDown, 
  GripVertical,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { logger } from '../../lib/logging/logger';

interface WaiverClaim {
  id: string;
  playerId: string;
  playerName?: string;
  position?: string;
  team?: string;
  bidAmount: number;
  priority: number;
  dropPlayerId?: string;
  dropPlayerName?: string;
  status: 'pending' | 'processed' | 'won' | 'lost';
  successProbability?: number;
  conflictRisk?: number;
}

interface WaiverPriorityManagerProps {
  claims: WaiverClaim[];
  onReorderClaims: (newOrder: WaiverClaim[]) => void;
}

interface SortableClaimProps {
  claim: WaiverClaim;
  index: number;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

const SortableClaim: React.FC<SortableClaimProps> = ({ 
  claim, 
  index, 
  onMoveUp, 
  onMoveDown, 
  isFirst, 
  isLast 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: claim.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPositionColor = (position: string) => {
    const colors = {
      QB: 'bg-red-500/20 text-red-300 border-red-500/30',
      RB: 'bg-green-500/20 text-green-300 border-green-500/30',
      WR: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      TE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      K: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      DST: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return colors[position as keyof typeof colors] || colors.QB;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'won':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'lost':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getRiskLevel = (conflictRisk?: number) => {
    if (!conflictRisk) return null;
    if (conflictRisk > 70) return { color: 'text-red-400', level: 'High Risk' };
    if (conflictRisk > 40) return { color: 'text-yellow-400', level: 'Medium Risk' };
    return { color: 'text-green-400', level: 'Low Risk' };
  };

  const riskLevel = getRiskLevel(claim.conflictRisk);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-700/50 border border-slate-600/50 rounded-lg p-4 ${
        isDragging ? 'shadow-2xl border-purple-400/50' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-purple-400 transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Priority Number */}
        <div className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full text-white font-bold text-sm">
          {claim.priority}
        </div>

        {/* Player Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold">
              {claim.playerName || `Player ${claim.playerId}`}
            </span>
            {claim.position && (
              <Badge className={`text-xs ${getPositionColor(claim.position)}`}>
                {claim.position}
              </Badge>
            )}
            {claim.team && (
              <span className="text-slate-400 text-sm">{claim.team}</span>
            )}
            {getStatusIcon(claim.status)}
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-400" />
              <span className="text-green-300">${claim.bidAmount}</span>
            </div>

            {claim.successProbability && (
              <div className="text-blue-300">
                {claim.successProbability}% success
              </div>
            )}

            {riskLevel && (
              <div className={`${riskLevel.color}`}>
                {riskLevel.level}
              </div>
            )}

            {claim.dropPlayerName && (
              <div className="text-slate-400">
                Dropping: {claim.dropPlayerName}
              </div>
            )}
          </div>
        </div>

        {/* Manual Controls */}
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMoveUp(claim.id)}
            disabled={isFirst}
            className="p-1 h-auto"
          >
            <ArrowUp className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMoveDown(claim.id)}
            disabled={isLast}
            className="p-1 h-auto"
          >
            <ArrowDown className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const WaiverPriorityManager: React.FC<WaiverPriorityManagerProps> = ({
  claims,
  onReorderClaims
}) => {
  const [localClaims, setLocalClaims] = useState(claims);

  React.useEffect(() => {
    setLocalClaims(claims.sort((a, b) => a.priority - b.priority));
  }, [claims]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = localClaims.findIndex(claim => claim.id === active.id);
      const newIndex = localClaims.findIndex(claim => claim.id === over?.id);

      const newOrder = [...localClaims];
      const [movedItem] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedItem);

      // Update priorities
      const updatedOrder = newOrder.map((claim, index) => ({
        ...claim,
        priority: index + 1
      }));

      setLocalClaims(updatedOrder);
      onReorderClaims(updatedOrder);
    }
  };

  const handleMoveUp = (claimId: string) => {
    const index = localClaims.findIndex(claim => claim.id === claimId);
    if (index > 0) {
      const newOrder = [...localClaims];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      
      const updatedOrder = newOrder.map((claim, idx) => ({
        ...claim,
        priority: idx + 1
      }));

      setLocalClaims(updatedOrder);
      onReorderClaims(updatedOrder);
    }
  };

  const handleMoveDown = (claimId: string) => {
    const index = localClaims.findIndex(claim => claim.id === claimId);
    if (index < localClaims.length - 1) {
      const newOrder = [...localClaims];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      
      const updatedOrder = newOrder.map((claim, idx) => ({
        ...claim,
        priority: idx + 1
      }));

      setLocalClaims(updatedOrder);
      onReorderClaims(updatedOrder);
    }
  };

  const optimizePriorities = async () => {
    try {
      const response = await fetch('/api/waivers/optimize-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims: localClaims })
      });

      if (response.ok) {
        const optimizedOrder = await response.json();
        setLocalClaims(optimizedOrder);
        onReorderClaims(optimizedOrder);
      }
    } catch (error) {
      logger.error('Error optimizing priorities:', { error: error });
    }
  };

  const getTotalSuccessProbability = () => {
    const totalProb = localClaims.reduce((sum, claim) => {
      return sum + (claim.successProbability || 0);
    }, 0);
    return localClaims.length > 0 ? (totalProb / localClaims.length).toFixed(1) : '0';
  };

  const getHighRiskClaims = () => {
    return localClaims.filter(claim => (claim.conflictRisk || 0) > 70).length;
  };

  return (
    <div className="space-y-6">
      {/* Priority Overview */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Waiver Priority Management
          </CardTitle>
          <Button 
            onClick={optimizePriorities}
            className="bg-purple-600 hover:bg-purple-700"
          >
            🤖 AI Optimize
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{localClaims.length}</div>
              <div className="text-sm text-slate-400">Total Claims</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{getTotalSuccessProbability()}%</div>
              <div className="text-sm text-slate-400">Avg Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{getHighRiskClaims()}</div>
              <div className="text-sm text-slate-400">High Risk Claims</div>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Priority Strategy Tips
            </h3>
            <div className="text-sm text-slate-300 space-y-1">
              <div>• Higher priority claims process first if multiple succeed</div>
              <div>• Consider roster needs when ordering similar-value players</div>
              <div>• Place high-upside, low-probability claims lower in priority</div>
              <div>• Account for bye week coverage in priority decisions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims List */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white">
            Claims Priority Order
          </CardTitle>
          <p className="text-slate-400 text-sm">
            Drag and drop to reorder, or use the arrow buttons. Higher priority claims process first.
          </p>
        </CardHeader>
        <CardContent>
          {localClaims.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Active Claims</h3>
              <p className="text-slate-400">
                Add waiver claims from the Available Players tab to manage their priority here.
              </p>
            </div>
          ) : (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localClaims.map(claim => claim.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {localClaims.map((claim, index) => (
                    <SortableClaim
                      key={claim.id}
                      claim={claim}
                      index={index}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      isFirst={index === 0}
                      isLast={index === localClaims.length - 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Processing Information */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            How Waiver Processing Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-white font-semibold mb-2">Processing Order</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2"></div>
                  <span>Claims process in priority order (1, 2, 3...)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2"></div>
                  <span>If multiple claims succeed, only highest priority executes</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2"></div>
                  <span>Failed claims don't affect lower priority claims</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">Success Factors</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                  <span>FAAB bid amount vs. competition</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                  <span>Player availability at processing time</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                  <span>Roster space (drops must be valid)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};