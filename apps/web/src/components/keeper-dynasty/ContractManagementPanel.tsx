'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BanknotesIcon,
  CalendarIcon,
  ScissorsIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import type { Player, ContractDetails } from '@/lib/services/traditional-fantasy/keeper-management/types';

interface ContractManagementPanelProps {
  roster: Player[];
  capSpace: number;
  keeperEngine: any;
}

interface ContractAction {
  type: 'restructure' | 'extend' | 'cut' | 'franchise';
  player: Player;
  currentContract: ContractDetails;
  proposedContract?: ContractDetails;
  capSavings: number;
  impact: string;
  recommendation: 'strongly-recommend' | 'recommend' | 'consider' | 'avoid';
}

export function ContractManagementPanel({ roster, capSpace, keeperEngine }: ContractManagementPanelProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [contractActions, setContractActions] = useState<ContractAction[]>([]);

  // Calculate cap metrics
  const capMetrics = useMemo(() => {
    const totalSalary = roster.reduce((sum, p) => sum + (p.contractDetails?.salary || 0), 0);
    const guaranteedMoney = roster.reduce((sum, p) => sum + (p.contractDetails?.guaranteedMoney || 0), 0);
    const deadMoney = roster.reduce((sum, p) => sum + (p.contractDetails?.deadMoneyIfCut || 0), 0);
    
    const salaryCap = 200; // League salary cap
    const capUsage = (totalSalary / salaryCap) * 100;
    const availableCap = salaryCap - totalSalary;
    
    return {
      totalSalary,
      guaranteedMoney,
      deadMoney,
      capUsage,
      availableCap,
      salaryCap
    };
  }, [roster]);

  // Group contracts by type
  const contractsByType = useMemo(() => {
    const groups: Record<string, Player[]> = {
      rookie: [],
      extension: [],
      freeAgent: [],
      franchise: []
    };
    
    roster.forEach(player => {
      if (player.contractDetails) {
        groups[player.contractDetails.contractType].push(player);
      }
    });
    
    return groups;
  }, [roster]);

  // Identify contract opportunities
  const contractOpportunities = useMemo(() => {
    const opportunities: ContractAction[] = [];
    
    roster.forEach(player => {
      if (!player.contractDetails) return;
      
      const contract = player.contractDetails;
      const performance = player.performanceHistory[0];
      const value = performance ? performance.fantasyPointsPerGame * 10 : 0;
      const efficiency = value / contract.salary;
      
      // Restructure candidates
      if (contract.restructurable && contract.yearsRemaining > 1 && efficiency < 0.8) {
        opportunities.push({
          type: 'restructure',
          player,
          currentContract: contract,
          capSavings: contract.salary * 0.3,
          impact: 'Convert salary to bonus, spread cap hit',
          recommendation: efficiency < 0.5 ? 'strongly-recommend' : 'recommend'
        });
      }
      
      // Extension candidates
      if (contract.extensionEligible && contract.yearsRemaining <= 1 && efficiency > 1.2) {
        opportunities.push({
          type: 'extend',
          player,
          currentContract: contract,
          capSavings: -contract.salary * 0.2, // Will cost more
          impact: 'Lock in core player before free agency',
          recommendation: player.age < 28 ? 'strongly-recommend' : 'consider'
        });
      }
      
      // Cut candidates
      if (efficiency < 0.5 && contract.deadMoneyIfCut < contract.salary * 0.5) {
        opportunities.push({
          type: 'cut',
          player,
          currentContract: contract,
          capSavings: contract.salary - contract.deadMoneyIfCut,
          impact: `Save $${(contract.salary - contract.deadMoneyIfCut).toFixed(1)}M with $${contract.deadMoneyIfCut}M dead cap`,
          recommendation: efficiency < 0.3 ? 'strongly-recommend' : 'consider'
        });
      }
      
      // Franchise tag candidates
      if (contract.franchiseTagEligible && contract.yearsRemaining === 0) {
        const tagCost = getPositionFranchiseTag(player.position);
        opportunities.push({
          type: 'franchise',
          player,
          currentContract: contract,
          capSavings: -tagCost,
          impact: `One-year deal at $${tagCost}M`,
          recommendation: player.age < 30 && efficiency > 1.5 ? 'consider' : 'avoid'
        });
      }
    });
    
    return opportunities.sort((a, b) => {
      const priority = { 'strongly-recommend': 3, 'recommend': 2, 'consider': 1, 'avoid': 0 };
      return priority[b.recommendation] - priority[a.recommendation];
    });
  }, [roster]);

  // Cap breakdown chart
  const capBreakdownData = {
    labels: ['Used Cap', 'Available Cap', 'Dead Money'],
    datasets: [{
      data: [
        capMetrics.totalSalary,
        capMetrics.availableCap,
        capMetrics.deadMoney
      ],
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(156, 163, 175, 0.8)'
      ],
      borderColor: [
        'rgb(239, 68, 68)',
        'rgb(34, 197, 94)',
        'rgb(156, 163, 175)'
      ],
      borderWidth: 1
    }]
  };

  // Position spending chart
  const positionSpendingData = useMemo(() => {
    const spending: Record<string, number> = {};
    roster.forEach(player => {
      if (player.contractDetails) {
        spending[player.position] = (spending[player.position] || 0) + player.contractDetails.salary;
      }
    });
    
    return {
      labels: Object.keys(spending),
      datasets: [{
        label: 'Salary by Position',
        data: Object.values(spending),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      }]
    };
  }, [roster]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)'
        }
      }
    },
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
  };

  const getRecommendationConfig = (recommendation: string) => {
    switch (recommendation) {
      case 'strongly-recommend':
        return { color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/50' };
      case 'recommend':
        return { color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/50' };
      case 'consider':
        return { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/50' };
      case 'avoid':
        return { color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' };
      default:
        return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/50' };
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'restructure':
        return ArrowPathIcon;
      case 'extend':
        return CalendarIcon;
      case 'cut':
        return ScissorsIcon;
      case 'franchise':
        return ShieldCheckIcon;
      default:
        return BanknotesIcon;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cap Overview */}
      <Card className="bg-gradient-to-br from-green-900/20 to-gray-900 border-green-500/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-green-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Contract Management</h2>
              <p className="text-gray-400">Optimize salary cap and contract structures</p>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowOptimizer(!showOptimizer)}
            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 font-medium transition-colors flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            AI Optimizer
          </motion.button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <p className="text-sm text-gray-500 mb-1">Cap Usage</p>
            <p className={`text-2xl font-bold ${
              capMetrics.capUsage > 90 ? 'text-red-400' :
              capMetrics.capUsage > 80 ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {capMetrics.capUsage.toFixed(1)}%
            </p>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full ${
                  capMetrics.capUsage > 90 ? 'bg-red-500' :
                  capMetrics.capUsage > 80 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${capMetrics.capUsage}%` }}
              />
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <p className="text-sm text-gray-500 mb-1">Available Cap</p>
            <p className="text-2xl font-bold text-green-400">
              ${capMetrics.availableCap.toFixed(1)}M
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {((capMetrics.availableCap / capMetrics.salaryCap) * 100).toFixed(0)}% of total
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <p className="text-sm text-gray-500 mb-1">Guaranteed</p>
            <p className="text-2xl font-bold text-orange-400">
              ${capMetrics.guaranteedMoney.toFixed(1)}M
            </p>
            <p className="text-xs text-gray-400 mt-1">Future liability</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <p className="text-sm text-gray-500 mb-1">Dead Money</p>
            <p className="text-2xl font-bold text-red-400">
              ${capMetrics.deadMoney.toFixed(1)}M
            </p>
            <p className="text-xs text-gray-400 mt-1">If all cut today</p>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-4">Cap Breakdown</h4>
            <div className="h-64">
              <Doughnut data={capBreakdownData} options={{
                ...chartOptions,
                maintainAspectRatio: false
              }} />
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-4">Position Spending</h4>
            <div className="h-64">
              <Bar data={positionSpendingData} options={chartOptions} />
            </div>
          </div>
        </div>
      </Card>

      {/* Contract Opportunities */}
      <Card className="bg-gray-800/50 border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Contract Opportunities</h3>
          <span className="px-2 py-1 bg-yellow-500/20 rounded text-sm text-yellow-400">
            {contractOpportunities.length} actions available
          </span>
        </div>

        <div className="space-y-4">
          {contractOpportunities.map((action, idx) => {
            const config = getRecommendationConfig(action.recommendation);
            const ActionIcon = getActionIcon(action.type);
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                      <ActionIcon className="w-5 h-5 text-gray-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        {action.player.name}
                        <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                          {action.type.toUpperCase()}
                        </span>
                      </h4>
                      <p className="text-sm text-gray-300 mt-1">{action.impact}</p>
                      
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Current:</span>
                          <span className="text-sm font-semibold text-white">
                            ${action.currentContract.salary}M
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Cap Impact:</span>
                          <span className={`text-sm font-semibold ${
                            action.capSavings > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {action.capSavings > 0 ? '+' : ''}{action.capSavings.toFixed(1)}M
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${config.color} capitalize`}>
                      {action.recommendation.replace('-', ' ')}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      {action.capSavings > 0 ? (
                        <TrendingUpIcon className="w-4 h-4 text-green-400" />
                      ) : (
                        <TrendingDownIcon className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-xs text-gray-400">
                        {Math.abs(action.capSavings).toFixed(1)}M {action.capSavings > 0 ? 'saved' : 'cost'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {contractOpportunities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No immediate contract actions recommended</p>
              <p className="text-sm mt-1">Your contracts are well-optimized</p>
            </div>
          )}
        </div>
      </Card>

      {/* Contract Details by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(contractsByType).map(([type, players]) => {
          if (players.length === 0) return null;
          
          return (
            <Card key={type} className="bg-gray-800/50 border-gray-700 p-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 capitalize">
                {type} Contracts ({players.length})
              </h4>
              <div className="space-y-2">
                {players.map(player => (
                  <motion.div
                    key={player.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedPlayer(player)}
                    className="bg-gray-900/50 rounded-lg p-3 cursor-pointer hover:bg-gray-900/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{player.name}</p>
                        <p className="text-xs text-gray-400">
                          {player.position} • {player.contractDetails!.yearsRemaining} years
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">
                          ${player.contractDetails!.salary}M
                        </p>
                        <p className="text-xs text-gray-400">
                          ${player.contractDetails!.guaranteedMoney}M GTD
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* AI Optimizer Panel */}
      <AnimatePresence>
        {showOptimizer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="bg-gradient-to-br from-purple-900/20 to-gray-900 border-purple-500/30 p-6">
              <div className="flex items-center gap-3 mb-4">
                <SparklesIcon className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-bold text-white">AI Contract Optimizer</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gray-800/50 rounded-lg p-4 text-center hover:bg-gray-700/50 transition-colors"
                >
                  <ArrowPathIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Auto-Restructure</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Optimize all eligible contracts
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gray-800/50 rounded-lg p-4 text-center hover:bg-gray-700/50 transition-colors"
                >
                  <ChartBarIcon className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Cap Projection</p>
                  <p className="text-xs text-gray-400 mt-1">
                    3-year cap analysis
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gray-800/50 rounded-lg p-4 text-center hover:bg-gray-700/50 transition-colors"
                >
                  <ClockIcon className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Extension Timing</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Optimal extension windows
                  </p>
                </motion.button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper function
function getPositionFranchiseTag(position: string): number {
  const tags: Record<string, number> = {
    QB: 32,
    RB: 10,
    WR: 19,
    TE: 12,
    K: 5,
    DEF: 15
  };
  return tags[position] || 15;
}