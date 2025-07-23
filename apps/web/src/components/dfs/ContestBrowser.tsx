'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Users,
  Trophy,
  Clock,
  AlertTriangle,
  Zap,
  Target,
  BarChart3,
  Eye,
  Star,
  ChevronRight,
  Info,
  Sparkles,
  Percent,
  Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CountUp from 'react-countup';

interface Contest {
  id: string;
  name: string;
  sport: string;
  type: 'GPP' | '50/50' | 'H2H' | 'Tournament' | 'Satellite' | 'Multiplier';
  entryFee: number;
  prizePool: number;
  guaranteedPrizePool: number;
  entries: number;
  maxEntries: number;
  maxEntriesPerUser: number;
  startTime: Date;
  overlay: number;
  expectedValue: number;
  projectedROI: number;
  sharpRatio: number;
  entryVelocity: number;
  featured?: boolean;
  recommended?: boolean;
}

interface FilterState {
  sport: string;
  type: string;
  minFee: number;
  maxFee: number;
  minOverlay: number;
  showRecommended: boolean;
}

const generateMockContests = (): Contest[] => {
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC'];
  const types: Contest['type'][] = ['GPP', '50/50', 'H2H', 'Tournament', 'Satellite', 'Multiplier'];
  
  return Array.from({ length: 50 }, (_, i) => {
    const sport = sports[Math.floor(Math.random() * sports.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const entryFee = [1, 3, 5, 10, 20, 50, 100, 250, 500][Math.floor(Math.random() * 9)];
    const guaranteedPrizePool = entryFee * (100 + Math.floor(Math.random() * 900));
    const maxEntries = [100, 500, 1000, 5000, 10000, 50000, 100000][Math.floor(Math.random() * 7)];
    const entries = Math.floor(maxEntries * (0.3 + Math.random() * 0.6));
    const currentPrizePool = entries * entryFee;
    const overlay = Math.max(0, (guaranteedPrizePool - currentPrizePool) / guaranteedPrizePool * 100);
    
    return {
      id: `contest-${i}`,
      name: `${sport} ${type === 'GPP' ? 'Millionaire Maker' : type} ${entryFee >= 100 ? 'High Roller' : ''}`.trim(),
      sport,
      type,
      entryFee,
      prizePool: currentPrizePool,
      guaranteedPrizePool,
      entries,
      maxEntries,
      maxEntriesPerUser: type === 'GPP' ? 150 : type === '50/50' ? 1 : 3,
      startTime: new Date(Date.now() + Math.random() * 86400000),
      overlay,
      expectedValue: overlay > 5 ? entryFee * (1 + overlay / 100) * 0.8 : entryFee * 0.95,
      projectedROI: overlay > 5 ? 15 + Math.random() * 25 : -5 + Math.random() * 15,
      sharpRatio: 0.5 + Math.random() * 2.5,
      entryVelocity: 10 + Math.random() * 90,
      featured: Math.random() > 0.9,
      recommended: overlay > 5 || Math.random() > 0.8
    };
  });
};

export const ContestBrowser: React.FC = () => {
  const [contests] = useState<Contest[]>(generateMockContests());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    sport: 'all',
    type: 'all',
    minFee: 0,
    maxFee: 1000,
    minOverlay: 0,
    showRecommended: false
  });

  const filteredContests = useMemo(() => {
    return contests.filter(contest => {
      if (searchTerm && !contest.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filters.sport !== 'all' && contest.sport !== filters.sport) return false;
      if (filters.type !== 'all' && contest.type !== filters.type) return false;
      if (contest.entryFee < filters.minFee || contest.entryFee > filters.maxFee) return false;
      if (contest.overlay < filters.minOverlay) return false;
      if (filters.showRecommended && !contest.recommended) return false;
      return true;
    });
  }, [contests, searchTerm, filters]);

  const sortedContests = useMemo(() => {
    return [...filteredContests].sort((a, b) => {
      // Sort by overlay first, then by EV
      if (b.overlay !== a.overlay) return b.overlay - a.overlay;
      return b.expectedValue - a.expectedValue;
    });
  }, [filteredContests]);

  const EVIndicator: React.FC<{ ev: number; entryFee: number }> = ({ ev, entryFee }) => {
    const evPercent = ((ev - entryFee) / entryFee) * 100;
    const isPositive = evPercent > 0;
    
    return (
      <div className={cn(
        "flex items-center gap-1 text-sm font-medium",
        isPositive ? "text-green-500" : "text-red-500"
      )}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
        {isPositive ? '+' : ''}{evPercent.toFixed(1)}%
      </div>
    );
  };

  const OverlayBadge: React.FC<{ overlay: number }> = ({ overlay }) => {
    if (overlay === 0) return null;
    
    return (
      <Badge className={cn(
        "text-xs",
        overlay > 10 ? "bg-green-500/20 text-green-500 border-green-500/50" :
        overlay > 5 ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" :
        "bg-blue-500/20 text-blue-500 border-blue-500/50"
      )}>
        <Percent className="w-3 h-3 mr-1" />
        {overlay.toFixed(1)}% Overlay
      </Badge>
    );
  };

  const ContestCard: React.FC<{ contest: Contest; index: number }> = ({ contest, index }) => {
    const fillPercent = (contest.entries / contest.maxEntries) * 100;
    const timeUntilStart = contest.startTime.getTime() - Date.now();
    const hoursUntilStart = Math.floor(timeUntilStart / 3600000);
    const minutesUntilStart = Math.floor((timeUntilStart % 3600000) / 60000);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.02 }}
        className="relative"
      >
        <Card 
          className={cn(
            "bg-gray-900 border-gray-800 p-4 cursor-pointer transition-all",
            "hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20",
            contest.featured && "border-yellow-500/50",
            contest.recommended && "border-green-500/50"
          )}
          onClick={() => setSelectedContest(contest)}
        >
          {contest.featured && (
            <div className="absolute -top-2 -right-2">
              <Badge className="bg-yellow-500 text-black">
                <Star className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}

          <div className="space-y-3">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-lg flex items-center gap-2">
                  {contest.name}
                  {contest.recommended && (
                    <Sparkles className="w-4 h-4 text-green-500" />
                  )}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {contest.sport}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {contest.type}
                  </Badge>
                  <OverlayBadge overlay={contest.overlay} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${contest.entryFee}</div>
                <div className="text-xs text-gray-400">Entry Fee</div>
              </div>
            </div>

            {/* Prize Pool */}
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-400">Prize Pool</div>
                <div className="text-xl font-bold text-green-500">
                  <CountUp
                    start={0}
                    end={contest.guaranteedPrizePool}
                    duration={1}
                    separator=","
                    prefix="$"
                  />
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Expected Value</div>
                <EVIndicator ev={contest.expectedValue} entryFee={contest.entryFee} />
              </div>
            </div>

            {/* Entry Progress */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-400">
                  {contest.entries.toLocaleString()} / {contest.maxEntries.toLocaleString()} entries
                </span>
                <span className="text-sm font-medium">
                  {fillPercent.toFixed(0)}% full
                </span>
              </div>
              <Progress value={fillPercent} className="h-2" />
              {contest.entryVelocity > 80 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-orange-500">
                  <Zap className="w-3 h-3" />
                  Filling fast!
                </div>
              )}
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
              <div className="text-center">
                <div className="text-xs text-gray-400">Sharpe</div>
                <div className="text-sm font-bold">{contest.sharpRatio.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">ROI</div>
                <div className={cn(
                  "text-sm font-bold",
                  contest.projectedROI > 0 ? "text-green-500" : "text-red-500"
                )}>
                  {contest.projectedROI > 0 ? '+' : ''}{contest.projectedROI.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Starts In</div>
                <div className="text-sm font-bold">
                  {hoursUntilStart}h {minutesUntilStart}m
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-900 border-gray-800 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Contest Browser</h2>
            <p className="text-gray-400">Find optimal contests with advanced EV calculations</p>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search contests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700"
              />
            </div>
            
            <Select value={filters.sport} onValueChange={(value) => setFilters({ ...filters, sport: value })}>
              <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700">
                <SelectValue placeholder="Sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="NFL">NFL</SelectItem>
                <SelectItem value="NBA">NBA</SelectItem>
                <SelectItem value="MLB">MLB</SelectItem>
                <SelectItem value="NHL">NHL</SelectItem>
                <SelectItem value="PGA">PGA</SelectItem>
                <SelectItem value="UFC">UFC</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
              <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="GPP">GPP</SelectItem>
                <SelectItem value="50/50">50/50</SelectItem>
                <SelectItem value="H2H">Head to Head</SelectItem>
                <SelectItem value="Tournament">Tournament</SelectItem>
                <SelectItem value="Satellite">Satellite</SelectItem>
                <SelectItem value="Multiplier">Multiplier</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className={cn(
                "border-gray-700",
                filters.showRecommended && "bg-green-500/20 border-green-500"
              )}
              onClick={() => setFilters({ ...filters, showRecommended: !filters.showRecommended })}
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">
              {sortedContests.filter(c => c.overlay > 5).length}
            </div>
            <div className="text-sm text-gray-400">+EV Contests</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-500">
              ${sortedContests.reduce((sum, c) => sum + c.guaranteedPrizePool, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total GPP</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-500">
              {sortedContests.filter(c => c.overlay > 10).length}
            </div>
            <div className="text-sm text-gray-400">High Overlay</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-500">
              {sortedContests.filter(c => c.featured).length}
            </div>
            <div className="text-sm text-gray-400">Featured</div>
          </div>
        </div>
      </Card>

      {/* Contest Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="all">All Contests</TabsTrigger>
          <TabsTrigger value="overlay">High Overlay</TabsTrigger>
          <TabsTrigger value="starting">Starting Soon</TabsTrigger>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedContests.map((contest, index) => (
              <ContestCard key={contest.id} contest={contest} index={index} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="overlay" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedContests
              .filter(c => c.overlay > 5)
              .map((contest, index) => (
                <ContestCard key={contest.id} contest={contest} index={index} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="starting" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedContests
              .filter(c => c.startTime.getTime() - Date.now() < 7200000)
              .map((contest, index) => (
                <ContestCard key={contest.id} contest={contest} index={index} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="recommended" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedContests
              .filter(c => c.recommended)
              .map((contest, index) => (
                <ContestCard key={contest.id} contest={contest} index={index} />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Contest Detail Modal */}
      <AnimatePresence>
        {selectedContest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedContest(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-4">{selectedContest.name}</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entry Fee:</span>
                    <span className="font-bold">${selectedContest.entryFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prize Pool:</span>
                    <span className="font-bold text-green-500">${selectedContest.guaranteedPrizePool.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Overlay:</span>
                    <span className="font-bold text-yellow-500">{selectedContest.overlay.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expected Value:</span>
                    <EVIndicator ev={selectedContest.expectedValue} entryFee={selectedContest.entryFee} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entries:</span>
                    <span className="font-bold">{selectedContest.entries.toLocaleString()} / {selectedContest.maxEntries.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Per User:</span>
                    <span className="font-bold">{selectedContest.maxEntriesPerUser}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Projected ROI:</span>
                    <span className={cn(
                      "font-bold",
                      selectedContest.projectedROI > 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {selectedContest.projectedROI > 0 ? '+' : ''}{selectedContest.projectedROI.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sharpe Ratio:</span>
                    <span className="font-bold">{selectedContest.sharpRatio.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 bg-green-600 hover:bg-green-700">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Enter Contest
                </Button>
                <Button variant="outline" className="flex-1">
                  <Calculator className="w-4 h-4 mr-2" />
                  Analyze Lineup
                </Button>
                <Button variant="outline" onClick={() => setSelectedContest(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContestBrowser;