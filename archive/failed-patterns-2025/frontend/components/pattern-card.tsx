import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { cn } from '../../lib/utils'

interface PatternCardProps {
  pattern: {
    name: string
    description: string
    accuracy: number
    roi: number
    occurrences: number
    confidence: 'high' | 'medium' | 'low'
  }
  className?: string
  onClick?: () => void
}

export function PatternCard({ pattern, className, onClick }: PatternCardProps) {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      case 'low':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getAccuracyGradient = (accuracy: number) => {
    if (accuracy >= 70) return 'from-green-600/20 to-green-800/20'
    if (accuracy >= 60) return 'from-yellow-600/20 to-yellow-800/20'
    return 'from-red-600/20 to-red-800/20'
  }

  return (
    <Card
      variant="pattern"
      hoverable
      className={cn(
        'relative overflow-hidden cursor-pointer',
        `bg-gradient-to-br ${getAccuracyGradient(pattern.accuracy)}`,
        className
      )}
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <div className="relative w-full h-full">
          <div className="absolute inset-0 bg-gradient-radial from-white to-transparent rounded-full animate-pulse-slow"></div>
        </div>
      </div>
      
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{pattern.name}</CardTitle>
            <CardDescription className="mt-1">{pattern.description}</CardDescription>
          </div>
          <Badge className={cn('ml-2', getConfidenceColor(pattern.confidence))}>
            {pattern.confidence.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">
              {pattern.accuracy}%
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
              Accuracy
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-pattern-gold">
              {pattern.roi}%
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
              ROI
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-300">
              {pattern.occurrences.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
              Found
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Profit Potential</span>
            <span className="text-sm font-semibold text-green-400">
              ${(pattern.occurrences * pattern.roi * 10).toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}