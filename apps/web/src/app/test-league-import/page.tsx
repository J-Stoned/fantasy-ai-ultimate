'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import useLeagueStore from '../../stores/useLeagueStore';

export default function TestLeagueImportPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const {
    leagues,
    importProgress,
    getConnectedPlatforms,
    getTotalLeagues,
    syncAllLeagues,
    updatePlatformAuth,
    importLeagues
  } = useLeagueStore();

  const runTests = async () => {
    setIsRunning(true);
    const results: any[] = [];

    // Test 1: Database Connection
    try {
      const response = await fetch('/api/leagues');
      const data = await response.json();
      
      results.push({
        test: 'Database Connection',
        status: response.ok ? 'PASS' : 'FAIL',
        details: response.ok ? `Connected, ${data.leagues?.length || 0} leagues found` : data.error,
        data: data
      });
    } catch (error) {
      results.push({
        test: 'Database Connection',
        status: 'FAIL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Mock Yahoo Import
    try {
      // Simulate successful Yahoo auth
      updatePlatformAuth('yahoo', {
        status: 'connected',
        accessToken: 'mock_token_123',
        username: 'test_user'
      });

      results.push({
        test: 'Yahoo Auth Simulation',
        status: 'PASS',
        details: 'Mock credentials set successfully'
      });

      // Test import with mock token
      await importLeagues('yahoo');
      
      results.push({
        test: 'Yahoo League Import',
        status: 'PASS',
        details: 'Import completed successfully'
      });
    } catch (error) {
      results.push({
        test: 'Yahoo League Import',
        status: 'FAIL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: Store Sync
    try {
      await syncAllLeagues();
      const totalLeagues = getTotalLeagues();
      
      results.push({
        test: 'Store Synchronization',
        status: 'PASS',
        details: `${totalLeagues} leagues in store after sync`
      });
    } catch (error) {
      results.push({
        test: 'Store Synchronization',
        status: 'FAIL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 4: API Endpoints
    const platforms = ['yahoo', 'espn', 'sleeper', 'cbs'];
    for (const platform of platforms) {
      try {
        const response = await fetch(`/api/import/${platform}/leagues`, {
          headers: {
            'Authorization': 'Bearer mock_token_test'
          }
        });
        
        results.push({
          test: `${platform.toUpperCase()} API Endpoint`,
          status: response.status === 401 ? 'PASS' : response.ok ? 'PASS' : 'FAIL',
          details: response.status === 401 ? 'Correctly requires auth' : 
                   response.ok ? 'Endpoint accessible' : `HTTP ${response.status}`
        });
      } catch (error) {
        results.push({
          test: `${platform.toUpperCase()} API Endpoint`,
          status: 'FAIL',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const clearDatabase = async () => {
    try {
      const allLeagues = Array.from(leagues.values());
      for (const league of allLeagues) {
        await fetch(`/api/leagues?id=${league.id}`, {
          method: 'DELETE'
        });
      }
      
      // Refresh store
      await syncAllLeagues();
      
      setTestResults(prev => [...prev, {
        test: 'Database Clear',
        status: 'PASS',
        details: `Cleared ${allLeagues.length} leagues`
      }]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        test: 'Database Clear',
        status: 'FAIL',
        details: error instanceof Error ? error.message : 'Unknown error'
      }]);
    }
  };

  // Auto-load leagues on mount
  useEffect(() => {
    syncAllLeagues();
  }, []);

  const totalLeagues = getTotalLeagues();
  const connectedPlatforms = getConnectedPlatforms();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            🧪 League Import System Test
          </h1>
          <p className="text-gray-300">
            Comprehensive testing of the fantasy league import infrastructure
          </p>
        </motion.div>

        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Current State</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Total Leagues:</span>
                <Badge variant="secondary">{totalLeagues}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Connected Platforms:</span>
                <Badge variant="secondary">{connectedPlatforms.length}</Badge>
              </div>
            </div>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Import Progress</h3>
            <div className="space-y-2">
              {Array.from(importProgress.entries()).map(([platform, progress]) => (
                <div key={platform} className="flex justify-between">
                  <span className="text-gray-300 capitalize">{platform}:</span>
                  <Badge 
                    variant={progress.status === 'completed' ? 'default' : 
                             progress.status === 'error' ? 'destructive' : 'secondary'}
                  >
                    {progress.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Actions</h3>
            <div className="space-y-3">
              <Button 
                onClick={runTests} 
                disabled={isRunning}
                className="w-full"
                variant="default"
              >
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              <Button 
                onClick={clearDatabase}
                className="w-full"
                variant="outline"
              >
                Clear Database
              </Button>
              <Button 
                onClick={syncAllLeagues}
                className="w-full"
                variant="ghost"
              >
                Sync Store
              </Button>
            </div>
          </Card>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Test Results</h3>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{result.test}</h4>
                    <p className="text-sm text-gray-400">{result.details}</p>
                  </div>
                  <Badge 
                    variant={result.status === 'PASS' ? 'default' : 'destructive'}
                    className={result.status === 'PASS' ? 'bg-green-600' : ''}
                  >
                    {result.status}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Current Leagues */}
        {totalLeagues > 0 && (
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6 mt-6">
            <h3 className="text-xl font-semibold text-white mb-4">Current Leagues</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(leagues.values()).map((league) => (
                <div
                  key={league.id}
                  className="p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-white text-sm">{league.name}</h4>
                    <Badge className="text-xs">{league.platform}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-gray-400">
                    <div>{league.sport.toUpperCase()} • {league.season}</div>
                    <div>{league.teamCount} teams</div>
                    {league.myTeamName && <div>My Team: {league.myTeamName}</div>}
                    {league.currentStanding && (
                      <div>Standing: #{league.currentStanding}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}