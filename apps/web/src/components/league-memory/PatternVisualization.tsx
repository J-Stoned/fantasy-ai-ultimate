'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadarController,
  RadialLinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Radar, Bar } from 'react-chartjs-2';
import { Activity, TrendingUp, BarChart3, Brain } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadarController,
  RadialLinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Pattern {
  id: string;
  name: string;
  type: 'temporal' | 'behavioral' | 'relational';
  data: any;
  description: string;
  managers: string[];
  frequency: number;
}

interface PatternVisualizationProps {
  patterns: Pattern[];
}

export default function PatternVisualization({ patterns }: PatternVisualizationProps) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(147, 51, 234, 0.5)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(147, 51, 234, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      y: {
        grid: {
          color: 'rgba(147, 51, 234, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }
    }
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)'
        }
      }
    },
    scales: {
      r: {
        grid: {
          color: 'rgba(147, 51, 234, 0.2)'
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.8)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          backdropColor: 'transparent'
        }
      }
    }
  };

  // Temporal Pattern - Trade Activity Over Time
  const temporalData = {
    labels: ['Week 1', 'Week 3', 'Week 6', 'Week 8', 'Week 10', 'Week 12', 'Week 14'],
    datasets: [
      {
        label: 'Aggressive Traders',
        data: [2, 5, 8, 12, 15, 18, 14],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        tension: 0.4
      },
      {
        label: 'Conservative Traders',
        data: [1, 1, 2, 3, 2, 4, 8],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4
      },
      {
        label: 'Opportunistic Traders',
        data: [3, 4, 6, 8, 10, 12, 16],
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        tension: 0.4
      }
    ]
  };

  // Behavioral Pattern - Manager Trait Comparison
  const behavioralData = {
    labels: ['Risk Taking', 'Analytics Usage', 'Social Trading', 'Waiver Activity', 'Trade Frequency', 'Win Rate'],
    datasets: [
      {
        label: 'Dynasty Dominators',
        data: [95, 70, 85, 60, 90, 78],
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
      },
      {
        label: 'Analytics Army',
        data: [60, 95, 40, 75, 50, 82],
        borderColor: 'rgb(34, 211, 238)',
        backgroundColor: 'rgba(34, 211, 238, 0.2)',
        pointBackgroundColor: 'rgb(34, 211, 238)',
        pointBorderColor: '#fff',
      }
    ]
  };

  // Relational Pattern - Trade Network Strength
  const relationalData = {
    labels: ['Dynasty Dom.', 'Steady Eddies', 'Waiver War.', 'Analytics Army', 'Rookie Hunt.', 'Trade Sharks'],
    datasets: [
      {
        label: 'Trade Frequency',
        data: [45, 12, 38, 28, 32, 52],
        backgroundColor: 'rgba(147, 51, 234, 0.6)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1
      },
      {
        label: 'Trade Success Rate',
        data: [78, 65, 71, 82, 69, 75],
        backgroundColor: 'rgba(34, 211, 238, 0.6)',
        borderColor: 'rgb(34, 211, 238)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Temporal Pattern */}
      <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Trading Activity Timeline
            </div>
            <Badge className="bg-purple-600/30 text-purple-200">Temporal Pattern</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Line data={temporalData} options={chartOptions} />
          </div>
          <p className="text-sm text-gray-300 mt-4">
            Shows trade volume patterns across the season. Aggressive traders peak mid-season, 
            while conservative managers become active near playoffs.
          </p>
        </CardContent>
      </Card>

      {/* Behavioral Pattern */}
      <Card className="bg-black/40 backdrop-blur-lg border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-400" />
              Manager Personality Profiles
            </div>
            <Badge className="bg-blue-600/30 text-blue-200">Behavioral Pattern</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <Radar data={behavioralData} options={radarOptions} />
          </div>
          <p className="text-sm text-gray-300 mt-4">
            Comparative analysis of manager traits. Larger area indicates more aggressive/active management style.
          </p>
        </CardContent>
      </Card>

      {/* Relational Pattern */}
      <Card className="bg-black/40 backdrop-blur-lg border-green-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-400" />
              Trade Network Analysis
            </div>
            <Badge className="bg-green-600/30 text-green-200">Relational Pattern</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Bar data={relationalData} options={chartOptions} />
          </div>
          <p className="text-sm text-gray-300 mt-4">
            Trade frequency vs success rate by manager. Higher bars indicate more active traders, 
            with success rate showing trade quality.
          </p>
        </CardContent>
      </Card>

      {/* Pattern Summary */}
      <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 backdrop-blur-lg border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Pattern Insights Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-black/30 rounded-lg">
              <p className="text-3xl font-bold text-purple-400">87%</p>
              <p className="text-sm text-gray-300 mt-1">Pattern Accuracy</p>
            </div>
            <div className="text-center p-4 bg-black/30 rounded-lg">
              <p className="text-3xl font-bold text-blue-400">23</p>
              <p className="text-sm text-gray-300 mt-1">Active Patterns</p>
            </div>
            <div className="text-center p-4 bg-black/30 rounded-lg">
              <p className="text-3xl font-bold text-green-400">156</p>
              <p className="text-sm text-gray-300 mt-1">Predictions Made</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}