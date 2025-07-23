'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  ComposedChart,
  Bar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  Shield,
  Activity,
  AlertCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortfolioItem {
  id: string;
  name: string;
  sport: string;
  value: number;
  change: number;
  changePercent: number;
  entries: number;
  risk: 'low' | 'medium' | 'high';
  correlation: number;
}

interface PerformanceMetric {
  date: string;
  portfolio: number;
  benchmark: number;
  drawdown: number;
}

interface RiskMetric {
  category: string;
  current: number;
  optimal: number;
  limit: number;
}

const COLORS = {
  NFL: '#013369',
  NBA: '#C8102E',
  MLB: '#003831',
  NHL: '#041E42',
  PGA: '#00205B',
  UFC: '#D20A0A',
  Soccer: '#0066CC',
  NCAAF: '#841617',
  NCAAB: '#FF6900'
};

export const PortfolioVisualizer: React.FC = () => {
  const treemapRef = useRef<HTMLDivElement>(null);
  const [selectedView, setSelectedView] = useState<'treemap' | 'sunburst' | 'force'>('treemap');
  const [hoveredItem, setHoveredItem] = useState<PortfolioItem | null>(null);
  
  const [portfolioData] = useState<PortfolioItem[]>([
    {
      id: '1',
      name: 'NFL GPP',
      sport: 'NFL',
      value: 4250,
      change: 325,
      changePercent: 8.3,
      entries: 15,
      risk: 'medium',
      correlation: 0.65
    },
    {
      id: '2',
      name: 'NBA 50/50',
      sport: 'NBA',
      value: 3100,
      change: -125,
      changePercent: -3.9,
      entries: 20,
      risk: 'low',
      correlation: 0.25
    },
    {
      id: '3',
      name: 'MLB Satellites',
      sport: 'MLB',
      value: 2800,
      change: 450,
      changePercent: 19.1,
      entries: 8,
      risk: 'high',
      correlation: 0.85
    },
    {
      id: '4',
      name: 'NHL Cash',
      sport: 'NHL',
      value: 1950,
      change: 75,
      changePercent: 4.0,
      entries: 12,
      risk: 'low',
      correlation: 0.15
    },
    {
      id: '5',
      name: 'PGA Majors',
      sport: 'PGA',
      value: 1650,
      change: -50,
      changePercent: -2.9,
      entries: 5,
      risk: 'high',
      correlation: 0.90
    },
    {
      id: '6',
      name: 'UFC Tournament',
      sport: 'UFC',
      value: 1200,
      change: 180,
      changePercent: 17.6,
      entries: 3,
      risk: 'high',
      correlation: 0.95
    }
  ]);

  const [performanceData] = useState<PerformanceMetric[]>([
    { date: 'Jan 1', portfolio: 10000, benchmark: 10000, drawdown: 0 },
    { date: 'Jan 8', portfolio: 10450, benchmark: 10150, drawdown: -2.1 },
    { date: 'Jan 15', portfolio: 11200, benchmark: 10300, drawdown: -1.5 },
    { date: 'Jan 22', portfolio: 10800, benchmark: 10400, drawdown: -5.8 },
    { date: 'Jan 29', portfolio: 11950, benchmark: 10550, drawdown: -3.2 },
    { date: 'Feb 5', portfolio: 12800, benchmark: 10700, drawdown: -1.1 },
    { date: 'Feb 12', portfolio: 13500, benchmark: 10850, drawdown: -0.8 },
    { date: 'Feb 19', portfolio: 14200, benchmark: 11000, drawdown: -2.3 },
    { date: 'Feb 26', portfolio: 15800, benchmark: 11150, drawdown: -0.5 }
  ]);

  const [riskMetrics] = useState<RiskMetric[]>([
    { category: 'Sport Concentration', current: 35, optimal: 25, limit: 40 },
    { category: 'Contest Type Risk', current: 45, optimal: 30, limit: 50 },
    { category: 'Correlation Risk', current: 62, optimal: 40, limit: 70 },
    { category: 'Volatility', current: 28, optimal: 20, limit: 35 },
    { category: 'Leverage', current: 15, optimal: 10, limit: 25 },
    { category: 'Liquidity', current: 88, optimal: 80, limit: 95 }
  ]);

  // Create interactive treemap
  useEffect(() => {
    if (treemapRef.current && selectedView === 'treemap') {
      d3.select(treemapRef.current).selectAll('*').remove();

      const width = treemapRef.current.clientWidth;
      const height = 400;

      const svg = d3.select(treemapRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      const root = d3.hierarchy({ children: portfolioData })
        .sum(d => d.value)
        .sort((a, b) => b.value! - a.value!);

      d3.treemap()
        .size([width, height])
        .padding(2)
        .round(true)(root);

      const leaf = svg.selectAll('g')
        .data(root.leaves())
        .enter().append('g')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

      // Add rectangles
      leaf.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => COLORS[d.data.sport as keyof typeof COLORS] || '#666')
        .attr('stroke', '#111')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 0.8);
          setHoveredItem(d.data as PortfolioItem);
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 1);
          setHoveredItem(null);
        });

      // Add text labels
      leaf.append('text')
        .attr('x', 4)
        .attr('y', 20)
        .style('fill', 'white')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => d.data.name);

      leaf.append('text')
        .attr('x', 4)
        .attr('y', 40)
        .style('fill', 'white')
        .style('font-size', '18px')
        .style('pointer-events', 'none')
        .text(d => `$${d.data.value.toLocaleString()}`);

      leaf.append('text')
        .attr('x', 4)
        .attr('y', 60)
        .style('fill', d => d.data.changePercent > 0 ? '#10b981' : '#ef4444')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => `${d.data.changePercent > 0 ? '+' : ''}${d.data.changePercent}%`);

      // Handle resize
      const handleResize = () => {
        if (treemapRef.current) {
          const newWidth = treemapRef.current.clientWidth;
          svg.attr('width', newWidth);
          
          d3.treemap()
            .size([newWidth, height])
            .padding(2)
            .round(true)(root);
          
          leaf.attr('transform', d => `translate(${d.x0},${d.y0})`);
          leaf.select('rect')
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [selectedView, portfolioData]);

  const pieData = useMemo(() => {
    return portfolioData.map(item => ({
      name: item.name,
      value: item.value,
      sport: item.sport
    }));
  }, [portfolioData]);

  const radarData = useMemo(() => {
    return riskMetrics.map(metric => ({
      metric: metric.category,
      current: metric.current,
      optimal: metric.optimal,
      limit: metric.limit
    }));
  }, [riskMetrics]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <p className="text-white font-bold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card className="bg-gray-900 border-gray-800 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">Portfolio Allocation</h2>
            <p className="text-gray-400">Visual breakdown of your DFS portfolio</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedView('treemap')}
              className={cn(selectedView === 'treemap' && 'bg-blue-500 text-white')}
            >
              Treemap
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedView('sunburst')}
              className={cn(selectedView === 'sunburst' && 'bg-blue-500 text-white')}
            >
              Pie Chart
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedView('force')}
              className={cn(selectedView === 'force' && 'bg-blue-500 text-white')}
            >
              Risk Radar
            </Button>
          </div>
        </div>

        {/* Visualization Container */}
        <div className="relative">
          {selectedView === 'treemap' && (
            <div ref={treemapRef} className="w-full h-[400px]" />
          )}

          {selectedView === 'sunburst' && (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.sport as keyof typeof COLORS] || '#666'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {selectedView === 'force' && (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid gridType="polygon" stroke="#374151" />
                <PolarAngleAxis dataKey="metric" stroke="#9CA3AF" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9CA3AF" />
                <Radar name="Current" dataKey="current" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Radar name="Optimal" dataKey="optimal" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                <Radar name="Limit" dataKey="limit" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {/* Hover Info */}
          <AnimatePresence>
            {hoveredItem && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 w-64"
              >
                <h4 className="font-bold text-lg mb-2">{hoveredItem.name}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sport:</span>
                    <Badge>{hoveredItem.sport}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Value:</span>
                    <span className="font-bold">${hoveredItem.value.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Change:</span>
                    <span className={cn(
                      "font-bold",
                      hoveredItem.changePercent > 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {hoveredItem.changePercent > 0 ? '+' : ''}{hoveredItem.changePercent}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entries:</span>
                    <span>{hoveredItem.entries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Risk Level:</span>
                    <Badge className={cn(
                      hoveredItem.risk === 'low' ? 'bg-green-500/20 text-green-500' :
                      hoveredItem.risk === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-red-500/20 text-red-500'
                    )}>
                      {hoveredItem.risk}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Correlation:</span>
                    <span>{(hoveredItem.correlation * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Performance Analytics */}
      <Card className="bg-gray-900 border-gray-800 p-6">
        <h3 className="text-xl font-bold mb-4">Performance Analytics</h3>
        
        <Tabs defaultValue="returns" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="sharpe">Risk-Adjusted</TabsTrigger>
            <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
          </TabsList>
          
          <TabsContent value="returns" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="benchmarkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9CA3AF" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="benchmark" 
                  stroke="#9CA3AF" 
                  fillOpacity={1} 
                  fill="url(#benchmarkGradient)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="portfolio" 
                  stroke="#3B82F6" 
                  fillOpacity={1} 
                  fill="url(#portfolioGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-xs text-gray-400">Total Return</div>
                <div className="text-lg font-bold text-green-500">+58.0%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">vs Benchmark</div>
                <div className="text-lg font-bold text-green-500">+46.5%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Win Rate</div>
                <div className="text-lg font-bold">68.5%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Avg Win/Loss</div>
                <div className="text-lg font-bold">2.3x</div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="sharpe" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis yAxisId="left" stroke="#9CA3AF" />
                <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="portfolio" fill="#3B82F6" />
                <Line yAxisId="right" type="monotone" dataKey="benchmark" stroke="#10B981" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-xs text-gray-400">Sharpe Ratio</div>
                <div className="text-lg font-bold">1.85</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Sortino Ratio</div>
                <div className="text-lg font-bold">2.42</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Calmar Ratio</div>
                <div className="text-lg font-bold">3.21</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Information Ratio</div>
                <div className="text-lg font-bold">1.67</div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="drawdown" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="drawdown" 
                  stroke="#EF4444" 
                  fillOpacity={1} 
                  fill="url(#drawdownGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-xs text-gray-400">Max Drawdown</div>
                <div className="text-lg font-bold text-red-500">-5.8%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Avg Drawdown</div>
                <div className="text-lg font-bold text-yellow-500">-2.4%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Recovery Time</div>
                <div className="text-lg font-bold">3.2 days</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Underwater %</div>
                <div className="text-lg font-bold">15.8%</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Risk Alerts */}
      <Card className="bg-gray-900 border-gray-800 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Risk Alerts & Recommendations
        </h3>
        
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">High NFL Concentration (35%)</p>
              <p className="text-sm text-gray-400">Consider diversifying into other sports to reduce correlation risk</p>
            </div>
            <Button size="sm" variant="outline" className="text-yellow-500 border-yellow-500">
              Rebalance
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
          >
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Optimal Entry Points Detected</p>
              <p className="text-sm text-gray-400">MLB late-night slates showing +EV opportunities</p>
            </div>
            <Button size="sm" variant="outline" className="text-blue-500 border-blue-500">
              View Contests
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
          >
            <Shield className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Portfolio Health: Excellent</p>
              <p className="text-sm text-gray-400">All risk metrics within optimal ranges</p>
            </div>
            <Badge className="bg-green-500/20 text-green-500">Healthy</Badge>
          </motion.div>
        </div>
      </Card>
    </div>
  );
};

export default PortfolioVisualizer;