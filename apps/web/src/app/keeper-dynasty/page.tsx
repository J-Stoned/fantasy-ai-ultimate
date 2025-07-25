'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Calendar,
  AlertTriangle,
  Sparkles,
  Target,
  RefreshCw
} from 'lucide-react';
import useLeagueStore from '../../stores/useLeagueStore';

// Import all our dynasty components
import { KeeperDecisionCard } from '../../components/dynasty/KeeperDecisionCard';
import { ChampionshipWindowVisualizer } from '../../components/dynasty/ChampionshipWindowVisualizer';
import { DynastyAssetManager } from '../../components/dynasty/DynastyAssetManager';
import { TradeCalculator } from '../../components/dynasty/TradeCalculator';
import { RookieDraftBoard } from '../../components/dynasty/RookieDraftBoard';
import { TeamStrategyAdvisor } from '../../components/dynasty/TeamStrategyAdvisor';
import { ContractManagementPanel } from '../../components/dynasty/ContractManagementPanel';
import { PlayerValueProjectionChart } from '../../components/dynasty/PlayerValueProjectionChart';
import { DynastyRosterOverview } from '../../components/dynasty/DynastyRosterOverview';

export default function KeeperDynastyPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<any>(null);
  
  const { leagues, selectedLeagueId, selectLeague, getSelectedLeague } = useLeagueStore();
  
  useEffect(() => {
    // Load selected league data
    const league = getSelectedLeague();
    if (league) {
      setSelectedLeague(league);
      setIsLoading(false);
    } else if (leagues.size > 0) {
      // Select first league if none selected
      const firstLeague = Array.from(leagues.values())[0];
      selectLeague(firstLeague.id);
      setSelectedLeague(firstLeague);
      setIsLoading(false);
    }
  }, [selectedLeagueId, leagues]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Dynasty Analysis...</p>
        </div>
      </div>
    );
  }

  if (!selectedLeague) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-8 max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">No League Selected</h2>
          <p className="text-gray-300 mb-6">Import a league or select one to start managing your dynasty!</p>
          <Button onClick={() => window.location.href = '/leagues/import'} className="w-full">
            Import League
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-400" />
                Dynasty Command Center
              </h1>
              <p className="text-gray-300 mt-1">
                AI-Powered Keeper & Dynasty Management for {selectedLeague.name}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-purple-600/20 text-purple-300 border-purple-500">
                {selectedLeague.sport.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-500">
                {selectedLeague.platform}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.reload()}
                className="text-white hover:bg-white/10"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Deadline Alerts */}
          <div className="mt-4 flex flex-wrap gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-600/20 text-red-300 px-3 py-1.5 rounded-full text-sm"
            >
              <AlertTriangle className="h-4 w-4" />
              Keeper Deadline: 14 days
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 bg-yellow-600/20 text-yellow-300 px-3 py-1.5 rounded-full text-sm"
            >
              <Calendar className="h-4 w-4" />
              Trade Deadline: 28 days
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 bg-green-600/20 text-green-300 px-3 py-1.5 rounded-full text-sm"
            >
              <Target className="h-4 w-4" />
              Championship Window: Peak Year 2
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/10 backdrop-blur-lg border border-white/20 p-1 grid grid-cols-5 lg:grid-cols-10 gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20">
              Overview
            </TabsTrigger>
            <TabsTrigger value="keepers" className="data-[state=active]:bg-white/20">
              Keepers
            </TabsTrigger>
            <TabsTrigger value="window" className="data-[state=active]:bg-white/20">
              Window
            </TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=active]:bg-white/20">
              Assets
            </TabsTrigger>
            <TabsTrigger value="trades" className="data-[state=active]:bg-white/20">
              Trades
            </TabsTrigger>
            <TabsTrigger value="draft" className="data-[state=active]:bg-white/20">
              Draft
            </TabsTrigger>
            <TabsTrigger value="strategy" className="data-[state=active]:bg-white/20">
              Strategy
            </TabsTrigger>
            <TabsTrigger value="contracts" className="data-[state=active]:bg-white/20">
              Contracts
            </TabsTrigger>
            <TabsTrigger value="projections" className="data-[state=active]:bg-white/20">
              Projections
            </TabsTrigger>
            <TabsTrigger value="roster" className="data-[state=active]:bg-white/20">
              Roster
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  Dynasty Status Overview
                </h2>
                <ChampionshipWindowVisualizer leagueId={selectedLeague.id} compact />
              </Card>
              
              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  AI Strategy Recommendations
                </h2>
                <TeamStrategyAdvisor leagueId={selectedLeague.id} compact />
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  Top Keeper Candidates
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Top 3 keeper candidates would be loaded here */}
                  <div className="text-center text-gray-400 col-span-full py-8">
                    Loading keeper recommendations...
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Keepers Tab */}
          <TabsContent value="keepers">
            <KeeperDecisionCard leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Championship Window Tab */}
          <TabsContent value="window">
            <ChampionshipWindowVisualizer leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets">
            <DynastyAssetManager leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades">
            <TradeCalculator leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Draft Tab */}
          <TabsContent value="draft">
            <RookieDraftBoard leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Strategy Tab */}
          <TabsContent value="strategy">
            <TeamStrategyAdvisor leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts">
            <ContractManagementPanel leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Projections Tab */}
          <TabsContent value="projections">
            <PlayerValueProjectionChart leagueId={selectedLeague.id} />
          </TabsContent>

          {/* Roster Tab */}
          <TabsContent value="roster">
            <DynastyRosterOverview leagueId={selectedLeague.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}