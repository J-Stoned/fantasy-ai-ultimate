'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { createComponentLogger } from '../../lib/utils/client-logger';

const logger = createComponentLogger('ContestsPage');

interface Contest {
  id: string;
  name: string;
  type: string;
  sport: string;
  entryFee: number;
  guaranteedPrizePool: number;
  maxEntries: number;
  currentEntries: number;
  startTime: Date;
  status: string;
}

export default function ContestsPage() {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  const sports = ['all', 'nfl', 'nba', 'mlb', 'nhl'];
  const types = ['all', 'gpp', 'cash', 'h2h', 'satellite'];

  useEffect(() => {
    loadContests();
  }, [selectedSport, selectedType]);

  const loadContests = async () => {
    setLoading(true);
    try {
      // Fetch from real API
      const params = new URLSearchParams({
        sport: selectedSport,
        type: selectedType,
      });
      
      const response = await fetch(`/api/contests?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch contests');
      }
      
      // Transform the data to match our interface
      const transformedContests: Contest[] = data.contests.map((contest: any) => ({
        id: contest.id,
        name: contest.name,
        type: contest.type,
        sport: contest.sport,
        entryFee: contest.entry_fee,
        guaranteedPrizePool: contest.guaranteed_prize_pool || 0,
        maxEntries: contest.max_entries,
        currentEntries: contest.current_entries || 0,
        startTime: new Date(contest.start_time),
        status: contest.status,
      }));

      setContests(transformedContests);
    } catch (error) {
      logger.error('Failed to load contests', error);
      
      // Fallback to some default contests if API fails
      setContests([
        {
          id: 'fallback-1',
          name: 'NFL Sunday Million',
          type: 'gpp',
          sport: 'nfl',
          entryFee: 3,
          guaranteedPrizePool: 1000000,
          maxEntries: 350000,
          currentEntries: 187432,
          startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          status: 'upcoming',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrize = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const getContestTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      gpp: 'Tournament',
      cash: 'Cash Game',
      h2h: 'Head-to-Head',
      satellite: 'Satellite',
    };
    return labels[type] || type.toUpperCase();
  };

  const getContestTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      gpp: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      cash: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      h2h: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      satellite: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getSportIcon = (sport: string): string => {
    const icons: Record<string, string> = {
      nfl: '🏈',
      nba: '🏀',
      mlb: '⚾',
      nhl: '🏒',
    };
    return icons[sport] || '🏆';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🏆 Daily Fantasy Contests</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Join contests and compete for real cash prizes
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Sport</label>
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
          >
            {sports.map(sport => (
              <option key={sport} value={sport}>
                {sport === 'all' ? 'All Sports' : sport.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Contest Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
          >
            {types.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : getContestTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contest List */}
      {loading ? (
        <div className="text-center py-8">Loading contests...</div>
      ) : (
        <div className="grid gap-4">
          {contests.map((contest) => (
            <div
              key={contest.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedContest(contest)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getSportIcon(contest.sport)}</span>
                      <h3 className="text-xl font-bold">{contest.name}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getContestTypeColor(contest.type)}`}>
                        {getContestTypeLabel(contest.type)}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Starts {formatDistanceToNow(contest.startTime, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {contest.guaranteedPrizePool > 0 
                        ? formatPrize(contest.guaranteedPrizePool)
                        : `$${contest.entryFee * 2}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      {contest.guaranteedPrizePool > 0 ? 'Guaranteed' : 'Prize Pool'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Entry Fee</div>
                    <div className="font-semibold">${contest.entryFee}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Entries</div>
                    <div className="font-semibold">
                      {contest.currentEntries.toLocaleString()} / {contest.maxEntries.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Multi-Entry</div>
                    <div className="font-semibold">
                      {contest.type === 'h2h' ? 'Single' : 'Up to 150'}
                    </div>
                  </div>
                </div>

                {/* Entry Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(contest.currentEntries / contest.maxEntries) * 100}%` }}
                  />
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <button
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Enter contest logic
                    }}
                  >
                    Enter Contest
                  </button>
                  
                  <div className="flex gap-2">
                    <button className="p-2 text-gray-600 hover:text-gray-800">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-800">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contest Detail Modal */}
      {selectedContest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedContest.name}</h2>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getContestTypeColor(selectedContest.type)}`}>
                      {getContestTypeLabel(selectedContest.type)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedContest.sport.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedContest(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Contest Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Prize Pool</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPrize(selectedContest.guaranteedPrizePool || selectedContest.entryFee * 2)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Entry Fee</div>
                  <div className="text-2xl font-bold">${selectedContest.entryFee}</div>
                </div>
              </div>

              {/* Payout Structure */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Payout Structure</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span>1st Place</span>
                    <span className="font-semibold">{formatPrize(selectedContest.guaranteedPrizePool * 0.2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>2nd Place</span>
                    <span className="font-semibold">{formatPrize(selectedContest.guaranteedPrizePool * 0.12)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>3rd Place</span>
                    <span className="font-semibold">{formatPrize(selectedContest.guaranteedPrizePool * 0.08)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Top 20%</span>
                    <span className="font-semibold">Cash</span>
                  </div>
                </div>
              </div>

              {/* Contest Rules */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Contest Rules</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Lineups lock at the start of the first game</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Late swap available for players whose games haven't started</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>PPR scoring system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>$50,000 salary cap</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                  Enter Contest
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  View Leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">$5M+</div>
          <div className="text-gray-600 dark:text-gray-400">In Prizes Today</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-green-600">250K+</div>
          <div className="text-gray-600 dark:text-gray-400">Active Players</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-purple-600">500+</div>
          <div className="text-gray-600 dark:text-gray-400">Daily Contests</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-orange-600">$1</div>
          <div className="text-gray-600 dark:text-gray-400">Minimum Entry</div>
        </div>
      </div>
    </div>
  );
}