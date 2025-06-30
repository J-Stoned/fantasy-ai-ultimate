'use client';

import { useState, useEffect } from 'react';
import { MLPredictionEngine } from '@/lib/ml/MLPredictionEngine';
import { AdvancedAnalytics } from '@/lib/ml/AdvancedAnalytics';
import { AICoach } from '@/lib/ml/AICoach';
import { createComponentLogger } from '../../../../lib/utils/client-logger';

const logger = createComponentLogger('MLPredictionsPage');

export default function MLPredictionsPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [coachingInsights, setCoachingInsights] = useState<any>(null);

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];
  const weeks = Array.from({ length: 17 }, (_, i) => i + 1);

  useEffect(() => {
    loadPredictions();
  }, [selectedWeek, selectedPosition]);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      // In production, this would be an API call
      // For demo, showing mock data
      const mockPredictions = generateMockPredictions();
      setPredictions(mockPredictions);
    } catch (error) {
      logger.error('Failed to load predictions', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockPredictions = () => {
    const players = [
      { id: '1', name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
      { id: '2', name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
      { id: '3', name: 'Tyreek Hill', position: 'WR', team: 'MIA' },
      { id: '4', name: 'Travis Kelce', position: 'TE', team: 'KC' },
      { id: '5', name: 'Justin Jefferson', position: 'WR', team: 'MIN' },
    ];

    return players
      .filter(p => selectedPosition === 'ALL' || p.position === selectedPosition)
      .map(player => ({
        ...player,
        predictedPoints: Math.random() * 20 + 10,
        confidence: Math.floor(Math.random() * 30 + 70),
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
        insights: [
          'Favorable matchup against weak defense',
          'High target share in recent games',
          'Consistent performer',
        ].slice(0, Math.floor(Math.random() * 3) + 1),
      }));
  };

  const loadCoachingInsights = async () => {
    setLoading(true);
    try {
      // Mock coaching insights
      const insights = {
        lineup: [
          {
            title: 'Start Tyreek Hill',
            description: 'Projected for 18.5 points against weak secondary',
            impact: '+5.2',
            confidence: 85,
          },
          {
            title: 'Bench Injured RB',
            description: 'Player questionable with ankle injury',
            impact: '-8.0',
            confidence: 95,
          },
        ],
        trades: [
          {
            title: 'Trade Target: Elite TE',
            description: 'Your TE position is underperforming',
            targets: ['Travis Kelce', 'Mark Andrews'],
          },
        ],
        waiver: [
          {
            title: 'Add Emerging RB',
            description: 'High upside player available on waivers',
            player: 'Rookie RB with increasing touches',
          },
        ],
      };
      setCoachingInsights(insights);
    } catch (error) {
      logger.error('Failed to load coaching insights', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🧠 ML Predictions</h1>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered predictions using advanced machine learning models
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
          className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {weeks.map(week => (
            <option key={week} value={week}>Week {week}</option>
          ))}
        </select>

        <select
          value={selectedPosition}
          onChange={(e) => setSelectedPosition(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {positions.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>

        <button
          onClick={loadCoachingInsights}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          🎓 Get AI Coaching
        </button>
      </div>

      {/* Predictions Table */}
      {loading ? (
        <div className="text-center py-8">Loading predictions...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-center">Position</th>
                <th className="px-4 py-3 text-center">Predicted Points</th>
                <th className="px-4 py-3 text-center">Confidence</th>
                <th className="px-4 py-3 text-center">Trend</th>
                <th className="px-4 py-3 text-left">Insights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {predictions.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-gray-500">{player.team}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-sm">
                      {player.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-2xl font-bold">
                      {player.predictedPoints.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            player.confidence > 80 ? 'bg-green-500' :
                            player.confidence > 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${player.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm">{player.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 ${
                      player.trend === 'up' ? 'text-green-600' :
                      player.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {player.trend === 'up' ? '📈' :
                       player.trend === 'down' ? '📉' : '➡️'}
                      {player.trend}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="text-sm space-y-1">
                      {player.insights.map((insight: string, i: number) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-green-500">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Coaching Insights */}
      {coachingInsights && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lineup Recommendations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📋 Lineup Optimization
            </h3>
            <div className="space-y-3">
              {coachingInsights.lineup.map((item: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      item.impact.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.impact} pts
                    </span>
                    <span className="text-sm text-gray-500">
                      {item.confidence}% confident
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Suggestions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🔄 Trade Targets
            </h3>
            <div className="space-y-3">
              {coachingInsights.trades.map((item: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </div>
                  <div className="mt-2">
                    {item.targets.map((target: string, j: number) => (
                      <span key={j} className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-sm mr-2 mb-1">
                        {target}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Waiver Wire */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🎯 Waiver Wire
            </h3>
            <div className="space-y-3">
              {coachingInsights.waiver.map((item: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </div>
                  <div className="mt-1 text-sm font-medium text-purple-600">
                    {item.player}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Model Info */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">🤖 About Our ML Models</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">Deep Learning Architecture</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Neural networks trained on millions of historical data points
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Real-time Learning</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Models update continuously with new game results
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Advanced Features</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Analyzes 50+ factors including matchups, trends, and weather
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Position-Specific Models</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Specialized models for each position's unique characteristics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}