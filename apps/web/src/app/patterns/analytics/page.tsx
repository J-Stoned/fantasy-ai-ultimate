'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PatternChart } from '../../../components/charts/PatternChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui'
import { Select } from '../../../components/ui/select'
import { Button } from '../../../components/ui'

// Mock data for charts
const generateMockData = () => {
  // Accuracy trend data
  const accuracyData = Array.from({ length: 30 }, (_, i) => ({
    name: `Day ${i + 1}`,
    accuracy: 65 + Math.random() * 15,
  }))

  // ROI comparison data
  const roiData = [
    { name: 'Back-to-Back Fade', roi: 46.6 },
    { name: 'Embarrassment Revenge', roi: 41.9 },
    { name: 'Altitude Advantage', roi: 36.3 },
    { name: 'Perfect Storm', roi: 35.9 },
    { name: 'Division Dog Bite', roi: 32.9 },
  ]

  // Occurrences over time
  const occurrencesData = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    occurrences: Math.floor(Math.random() * 50) + 20,
  }))

  // Win/Loss performance
  const performanceData = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    wins: Math.floor(Math.random() * 20) + 10,
    losses: Math.floor(Math.random() * 10) + 2,
  }))

  // Radar chart data
  const radarData = [
    { metric: 'Accuracy', value: 76.8 },
    { metric: 'ROI', value: 46.6 },
    { metric: 'Frequency', value: 65 },
    { metric: 'Confidence', value: 85 },
    { metric: 'Profit Factor', value: 72 },
    { metric: 'Win Rate', value: 68 },
  ]

  // Distribution data
  const distributionData = [
    { name: 'Football', value: 45 },
    { name: 'Basketball', value: 30 },
    { name: 'Baseball', value: 15 },
    { name: 'Hockey', value: 10 },
  ]

  return {
    accuracyData,
    roiData,
    occurrencesData,
    performanceData,
    radarData,
    distributionData,
  }
}

export default function PatternAnalyticsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d')
  const [selectedPattern, setSelectedPattern] = useState('all')
  const [data, setData] = useState(generateMockData())
  const [isLoading, setIsLoading] = useState(false)

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => {
      setData(generateMockData())
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Back Navigation */}
      <Link href="/patterns" className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Patterns
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Pattern <span className="gradient-text">Analytics</span>
            </h1>
            <p className="text-xl text-gray-400">Deep dive into pattern performance</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <Select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="w-full md:w-40"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </Select>
            
            <Select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="w-full md:w-48"
            >
              <option value="all">All Patterns</option>
              <option value="back-to-back">Back-to-Back Fade</option>
              <option value="revenge">Embarrassment Revenge</option>
              <option value="altitude">Altitude Advantage</option>
              <option value="storm">Perfect Storm</option>
              <option value="division">Division Dog Bite</option>
            </Select>
            
            <Button
              onClick={handleRefresh}
              loading={isLoading}
              variant="secondary"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold gradient-text">76.8%</div>
            <div className="text-xs text-gray-400 mt-1">Best Accuracy</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-pattern-gold">46.6%</div>
            <div className="text-xs text-gray-400 mt-1">Best ROI</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">36,846</div>
            <div className="text-xs text-gray-400 mt-1">Total Triggers</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">$1.15M</div>
            <div className="text-xs text-gray-400 mt-1">Profit Potential</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-400">27,575</div>
            <div className="text-xs text-gray-400 mt-1">High-Value Bets</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PatternChart
          type="accuracy"
          data={data.accuracyData}
          title="Accuracy Trend"
          description="Pattern accuracy over the selected timeframe"
        />
        
        <PatternChart
          type="roi"
          data={data.roiData}
          title="ROI Comparison"
          description="Return on investment by pattern type"
        />
        
        <PatternChart
          type="occurrences"
          data={data.occurrencesData}
          title="Pattern Triggers"
          description="Daily pattern occurrences"
        />
        
        <PatternChart
          type="performance"
          data={data.performanceData}
          title="Win/Loss Performance"
          description="Daily win and loss distribution"
        />
      </div>

      {/* Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PatternChart
          type="radar"
          data={data.radarData}
          title="Pattern Strength Analysis"
          description="Multi-dimensional pattern performance metrics"
        />
        
        <PatternChart
          type="distribution"
          data={data.distributionData}
          title="Sport Distribution"
          description="Pattern triggers by sport category"
        />
      </div>

      {/* Insights Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
          <CardDescription>AI-generated pattern analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="text-white font-medium">Back-to-Back Fade maintains highest accuracy</p>
                <p className="text-sm text-gray-400 mt-1">
                  Consistent 76.8% win rate over 8,234 occurrences shows strong reliability
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <p className="text-white font-medium">Football patterns show best ROI potential</p>
                <p className="text-sm text-gray-400 mt-1">
                  NFL and college football patterns average 15% higher returns than other sports
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="text-white font-medium">Weekend triggers spike 3x on average</p>
                <p className="text-sm text-gray-400 mt-1">
                  Saturday and Sunday show significantly more pattern opportunities
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}