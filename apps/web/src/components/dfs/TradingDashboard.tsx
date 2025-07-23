'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, HistogramData, ColorType, CrosshairMode } from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle,
  Shield,
  Zap,
  Eye,
  DollarSign,
  Users,
  BarChart3,
  PieChart,
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContestData {
  id: string;
  name: string;
  entryFee: number;
  prizePool: number;
  entries: number;
  maxEntries: number;
  overlay: number;
  expectedValue: number;
  sharpRatio: number;
  volatility: number;
  priceHistory: CandlestickData[];
  volumeHistory: HistogramData[];
}

interface PortfolioMetrics {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalInvested: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  roi: number;
}

interface NewsItem {
  id: string;
  timestamp: Date;
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  sport: string;
}

export const TradingDashboard: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  const [selectedContest, setSelectedContest] = useState<ContestData | null>(null);
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics>({
    totalValue: 15842.50,
    dayChange: 523.75,
    dayChangePercent: 3.42,
    totalInvested: 12500,
    totalReturn: 3342.50,
    sharpeRatio: 1.85,
    maxDrawdown: -12.3,
    winRate: 68.5,
    roi: 26.74
  });
  
  const [newsItems] = useState<NewsItem[]>([
    {
      id: '1',
      timestamp: new Date(),
      title: 'LeBron James ruled out for tonight\'s game',
      sentiment: 'negative',
      impact: 'high',
      sport: 'NBA'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1800000),
      title: 'Weather alert: Snow expected for Sunday NFL games',
      sentiment: 'negative',
      impact: 'medium',
      sport: 'NFL'
    }
  ]);

  // Initialize TradingView-style chart
  useEffect(() => {
    if (chartContainerRef.current && !chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#D1D5DB',
        },
        grid: {
          vertLines: { color: 'rgba(42, 46, 57, 0.6)' },
          horzLines: { color: 'rgba(42, 46, 57, 0.6)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#2a2e39',
        },
        timeScale: {
          borderColor: '#2a2e39',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;
      volumeSeriesRef.current = volumeSeries;

      // Generate sample data
      const data = generateSampleData();
      candlestickSeries.setData(data.candlesticks);
      volumeSeries.setData(data.volumes);

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    }
  }, []);

  // Generate sample candlestick data
  const generateSampleData = () => {
    const candlesticks: CandlestickData[] = [];
    const volumes: HistogramData[] = [];
    const basePrice = 100;
    const baseTime = Math.floor(Date.now() / 1000) - 86400 * 30;

    for (let i = 0; i < 30; i++) {
      const time = (baseTime + i * 86400) as any;
      const open = basePrice + Math.random() * 20 - 10;
      const close = open + Math.random() * 10 - 5;
      const high = Math.max(open, close) + Math.random() * 5;
      const low = Math.min(open, close) - Math.random() * 5;
      
      candlesticks.push({ time, open, high, low, close });
      volumes.push({ 
        time, 
        value: Math.random() * 1000000,
        color: close > open ? '#26a69a' : '#ef5350'
      });
    }

    return { candlesticks, volumes };
  };

  const CircuitBreakerIndicator = () => {
    const [level, setLevel] = useState(35);
    
    useEffect(() => {
      const interval = setInterval(() => {
        setLevel(prev => {
          const newLevel = prev + (Math.random() - 0.5) * 10;
          return Math.max(0, Math.min(100, newLevel));
        });
      }, 2000);
      return () => clearInterval(interval);
    }, []);

    return (
      <div className="relative w-full h-24">
        <svg className="w-full h-full" viewBox="0 0 200 100">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          
          <path
            d="M 20 80 A 60 60 0 0 1 180 80"
            fill="none"
            stroke="#374151"
            strokeWidth="10"
            strokeLinecap="round"
          />
          
          <path
            d="M 20 80 A 60 60 0 0 1 180 80"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${level * 1.57} 157`}
          />
          
          <motion.line
            x1="100"
            y1="80"
            x2={100 + 60 * Math.cos((Math.PI * (180 + level * 1.8)) / 180)}
            y2={80 + 60 * Math.sin((Math.PI * (180 + level * 1.8)) / 180)}
            stroke="#fff"
            strokeWidth="3"
            animate={{ x2: 100 + 60 * Math.cos((Math.PI * (180 + level * 1.8)) / 180) }}
            transition={{ type: "spring", stiffness: 50 }}
          />
        </svg>
        
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
          <div className="text-2xl font-bold">{level.toFixed(0)}%</div>
          <div className="text-xs text-gray-400">Risk Level</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-[1920px] mx-auto space-y-4">
        {/* Header Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-400">Portfolio</span>
            </div>
            <div className="text-xl font-bold">${portfolioMetrics.totalValue.toLocaleString()}</div>
            <div className={cn(
              "text-sm",
              portfolioMetrics.dayChangePercent > 0 ? "text-green-500" : "text-red-500"
            )}>
              {portfolioMetrics.dayChangePercent > 0 ? '+' : ''}{portfolioMetrics.dayChangePercent.toFixed(2)}%
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-400">Win Rate</span>
            </div>
            <div className="text-xl font-bold">{portfolioMetrics.winRate}%</div>
            <Progress value={portfolioMetrics.winRate} className="h-1 mt-2" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-400">Sharpe Ratio</span>
            </div>
            <div className="text-xl font-bold">{portfolioMetrics.sharpeRatio}</div>
            <div className="text-sm text-gray-400">Excellent</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-400">ROI</span>
            </div>
            <div className="text-xl font-bold">+{portfolioMetrics.roi}%</div>
            <div className="text-sm text-green-500">+${portfolioMetrics.totalReturn.toLocaleString()}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-400">Max Drawdown</span>
            </div>
            <div className="text-xl font-bold">{portfolioMetrics.maxDrawdown}%</div>
            <div className="text-sm text-gray-400">Controlled</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              <span className="text-xs text-gray-400">Active Entries</span>
            </div>
            <div className="text-xl font-bold">47</div>
            <div className="text-sm text-gray-400">12 sports</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-gray-400">Avg Overlay</span>
            </div>
            <div className="text-xl font-bold">4.2%</div>
            <div className="text-sm text-green-500">Optimal</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-400">EV/Hour</span>
            </div>
            <div className="text-xl font-bold">$127</div>
            <div className="text-sm text-gray-400">Peak perf</div>
          </motion.div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Chart Section - 2 columns wide */}
          <div className="xl:col-span-2 space-y-4">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Contest Price Action</h2>
                  <p className="text-gray-400">Real-time contest value tracking</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">1H</Button>
                  <Button variant="outline" size="sm">4H</Button>
                  <Button variant="outline" size="sm" className="bg-blue-500 text-white">1D</Button>
                  <Button variant="outline" size="sm">1W</Button>
                </div>
              </div>
              
              <div ref={chartContainerRef} className="w-full h-[400px]" />
              
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400">24h Volume</div>
                  <div className="text-lg font-bold">$2.4M</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">24h High</div>
                  <div className="text-lg font-bold text-green-500">$127.50</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">24h Low</div>
                  <div className="text-lg font-bold text-red-500">$98.25</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">24h Change</div>
                  <div className="text-lg font-bold text-green-500">+12.4%</div>
                </div>
              </div>
            </Card>

            {/* Risk Monitoring Panel */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4">Risk Monitoring</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <CircuitBreakerIndicator />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Exposure Limit</span>
                      <span>$3,500 / $5,000</span>
                    </div>
                    <Progress value={70} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Daily Loss Limit</span>
                      <span>$450 / $1,000</span>
                    </div>
                    <Progress value={45} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Correlation Risk</span>
                      <span className="text-yellow-500">Medium</span>
                    </div>
                    <Progress value={55} className="h-2 mt-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Badge className="w-full justify-center bg-green-500/20 text-green-500">
                    All Systems Normal
                  </Badge>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Circuit breaker: Active
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Auto-hedge: Enabled
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      Position sizing: Conservative
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* News Feed */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Live News Feed
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                <AnimatePresence>
                  {newsItems.map((news, index) => (
                    <motion.div
                      key={news.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-full",
                          news.sentiment === 'positive' ? 'bg-green-500/20' : 
                          news.sentiment === 'negative' ? 'bg-red-500/20' : 
                          'bg-gray-500/20'
                        )}>
                          <AlertTriangle className={cn(
                            "w-4 h-4",
                            news.sentiment === 'positive' ? 'text-green-500' : 
                            news.sentiment === 'negative' ? 'text-red-500' : 
                            'text-gray-500'
                          )} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {news.sport}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                news.impact === 'high' ? 'border-red-500 text-red-500' :
                                news.impact === 'medium' ? 'border-yellow-500 text-yellow-500' :
                                'border-gray-500 text-gray-500'
                              )}
                            >
                              {news.impact} impact
                            </Badge>
                          </div>
                          <p className="text-sm">{news.title}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(news.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Enter Contest
                </Button>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <Shield className="w-4 h-4 mr-2" />
                  Risk Settings
                </Button>
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  <PieChart className="w-4 h-4 mr-2" />
                  Portfolio Analysis
                </Button>
              </div>
            </Card>

            {/* Performance Summary */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4">Today\'s Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Contests Entered</span>
                  <span className="font-bold">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Invested</span>
                  <span className="font-bold">$1,850</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Current Value</span>
                  <span className="font-bold text-green-500">$2,374</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Profit/Loss</span>
                  <span className="font-bold text-green-500">+$524 (+28.3%)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Avg EV</span>
                  <span className="font-bold">+4.7%</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;