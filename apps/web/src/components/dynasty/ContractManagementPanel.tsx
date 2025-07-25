'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiCalendar, FiTrendingUp, FiAlertTriangle, FiEdit2, FiSave } from 'react-icons/fi';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { contractManagementService } from '@/lib/services/traditional-fantasy/keeper-management/contract-management-service';
import type { PlayerContract, SalaryCapInfo } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ContractManagementPanelProps {
  leagueId: string;
  teamId: string;
}

export const ContractManagementPanel: React.FC<ContractManagementPanelProps> = ({
  leagueId,
  teamId
}) => {
  const [contracts, setContracts] = useState<PlayerContract[]>([]);
  const [capInfo, setCapInfo] = useState<SalaryCapInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingContract, setEditingContract] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'expiring' | 'extensions'>('all');

  useEffect(() => {
    loadContractData();
  }, [leagueId, teamId]);

  const loadContractData = async () => {
    setLoading(true);
    try {
      const [contractsData, capData] = await Promise.all([
        contractManagementService.getTeamContracts(leagueId, teamId),
        contractManagementService.getSalaryCapInfo(leagueId, teamId)
      ]);
      setContracts(contractsData);
      setCapInfo(capData);
    } catch (error) {
      logger.error('Failed to load contract data:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const handleContractUpdate = async (contractId: string, updates: Partial<PlayerContract>) => {
    try {
      await contractManagementService.updateContract(leagueId, contractId, updates);
      await loadContractData();
      setEditingContract(null);
    } catch (error) {
      logger.error('Failed to update contract:', { error: error });
    }
  };

  if (loading || !capInfo) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700/50 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-700/50 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredContracts = contracts.filter(contract => {
    if (filter === 'all') return true;
    if (filter === 'expiring') return contract.yearsRemaining <= 1;
    if (filter === 'extensions') return contract.extensionEligible;
    return true;
  });

  const capSpaceByYear = {
    labels: ['2024', '2025', '2026', '2027', '2028'],
    datasets: [
      {
        label: 'Committed Salary',
        data: capInfo.projectedCapByYear.map(y => y.committed),
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2
      },
      {
        label: 'Available Cap',
        data: capInfo.projectedCapByYear.map(y => y.available),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2
      }
    ]
  };

  const positionSpending = {
    labels: ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'],
    datasets: [
      {
        label: 'Current Spending',
        data: [
          capInfo.positionSpending.QB || 0,
          capInfo.positionSpending.RB || 0,
          capInfo.positionSpending.WR || 0,
          capInfo.positionSpending.TE || 0,
          capInfo.positionSpending.DEF || 0,
          capInfo.positionSpending.K || 0
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 2
      },
      {
        label: 'League Average',
        data: [22, 20, 28, 12, 10, 8], // Example league averages
        backgroundColor: 'rgba(107, 114, 128, 0.5)',
        borderColor: 'rgb(107, 114, 128)',
        borderWidth: 2
      }
    ]
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#fff',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: $${value}M`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#9CA3AF'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9CA3AF',
          callback: function(value) {
            return '$' + value + 'M';
          }
        }
      }
    }
  };

  const getCapHealthColor = () => {
    const usage = (capInfo.currentCap.used / capInfo.currentCap.total) * 100;
    if (usage < 70) return 'text-green-400';
    if (usage < 85) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getContractValueColor = (value: number, position: string) => {
    // This would compare to market values
    if (value < 10) return 'text-green-400';
    if (value < 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header & Cap Overview */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Contract Management</h2>
            <p className="text-gray-400">Optimize salary cap and player contracts</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Available Cap Space</p>
            <p className={`text-3xl font-bold ${getCapHealthColor()}`}>
              ${capInfo.currentCap.available}M
            </p>
          </div>
        </div>

        {/* Cap Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiDollarSign className="text-purple-400" />
              <span className="text-2xl font-bold text-white">
                ${capInfo.currentCap.total}M
              </span>
            </div>
            <p className="text-xs text-gray-400">Total Cap</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiTrendingUp className="text-blue-400" />
              <span className="text-2xl font-bold text-white">
                {capInfo.contractsExpiring}
              </span>
            </div>
            <p className="text-xs text-gray-400">Expiring Contracts</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiCalendar className="text-green-400" />
              <span className="text-2xl font-bold text-white">
                ${capInfo.deadMoney}M
              </span>
            </div>
            <p className="text-xs text-gray-400">Dead Money</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiAlertTriangle className="text-yellow-400" />
              <span className="text-2xl font-bold text-white">
                {capInfo.extensionsNeeded}
              </span>
            </div>
            <p className="text-xs text-gray-400">Extensions Needed</p>
          </div>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Cap Space Projection</h3>
          <div className="h-64">
            <Bar data={capSpaceByYear} options={chartOptions} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Position Spending</h3>
          <div className="h-64">
            <Bar data={positionSpending} options={chartOptions} />
          </div>
        </motion.div>
      </div>

      {/* Contracts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Player Contracts</h3>
          <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('expiring')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === 'expiring' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Expiring
            </button>
            <button
              onClick={() => setFilter('extensions')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === 'extensions' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Extensions
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Player</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Position</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Salary</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Years</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Cap Hit</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Value</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredContracts.map((contract, index) => (
                  <motion.tr
                    key={contract.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-white">{contract.playerName}</p>
                        {contract.extensionEligible && (
                          <span className="text-xs text-yellow-400">Extension Eligible</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-400">{contract.position}</td>
                    <td className="py-3 px-4 text-center">
                      {editingContract === contract.id ? (
                        <input
                          type="number"
                          value={contract.salary}
                          onChange={(e) => {/* Handle change */}}
                          className="w-20 px-2 py-1 bg-gray-700 text-white rounded text-center"
                        />
                      ) : (
                        <span className="text-white">${contract.salary}M</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-medium ${
                        contract.yearsRemaining <= 1 ? 'text-red-400' : 'text-white'
                      }`}>
                        {contract.yearsRemaining}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-white">
                      ${contract.capHit}M
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-medium ${getContractValueColor(contract.salary, contract.position)}`}>
                        {contract.value > 0 ? '+' : ''}{contract.value}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingContract === contract.id ? (
                        <button
                          onClick={() => handleContractUpdate(contract.id, { salary: contract.salary })}
                          className="text-green-400 hover:text-green-300 transition-colors"
                        >
                          <FiSave />
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingContract(contract.id)}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <FiEdit2 />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Contract Recommendations */}
        {capInfo.recommendations && capInfo.recommendations.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Recommendations</h4>
            {capInfo.recommendations.map((rec, index) => (
              <div
                key={index}
                className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
              >
                <div className="flex items-start space-x-3">
                  <FiAlertTriangle className={`mt-1 ${
                    rec.priority === 'high' ? 'text-red-400' :
                    rec.priority === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{rec.action}</p>
                    <p className="text-xs text-gray-400 mt-1">{rec.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};