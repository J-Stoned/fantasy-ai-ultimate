'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Target,
  Brain,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Sparkles,
  Eye
} from 'lucide-react';

interface Prediction {
  id: string;
  manager: string;
  action: string;
  confidence: number;
  timeframe: string;
  triggers: string[];
  reasoning: string;
  impact: 'high' | 'medium' | 'low';
  recommendations: string[];
}

interface BehaviorPredictionPanelProps {
  predictions: Prediction[];
  onPredictionSelect?: (prediction: Prediction) => void;
}

export default function BehaviorPredictionPanel({ 
  predictions, 
  onPredictionSelect 
}: BehaviorPredictionPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-900/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30';
      case 'low': return 'text-green-400 bg-green-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'from-green-500 to-emerald-500';
    if (confidence >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  return (
    <div className="space-y-4">
      {predictions.map((prediction) => (
        <Card 
          key={prediction.id}
          className="bg-black/40 backdrop-blur-lg border-blue-500/30 hover:border-blue-400/50 transition-all"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                <span className="text-white">{prediction.manager}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getImpactColor(prediction.impact)}`}>
                  {prediction.impact.toUpperCase()} IMPACT
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpandedId(expandedId === prediction.id ? null : prediction.id)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  <ChevronRight 
                    className={`w-4 h-4 transition-transform ${
                      expandedId === prediction.id ? 'rotate-90' : ''
                    }`}
                  />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Prediction */}
            <div className="bg-blue-900/30 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 mt-1" />
                <div className="flex-1">
                  <p className="text-white font-medium text-lg mb-2">
                    {prediction.action}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{prediction.timeframe}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Confidence:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-700 rounded-full h-2">
                          <div
                            className={`bg-gradient-to-r ${getConfidenceColor(prediction.confidence)} h-2 rounded-full`}
                            style={{ width: `${prediction.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-white">
                          {prediction.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Triggers */}
            <div>
              <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Watch for these triggers:
              </h4>
              <div className="flex flex-wrap gap-2">
                {prediction.triggers.map((trigger, idx) => (
                  <Badge 
                    key={idx}
                    variant="outline"
                    className="text-xs border-blue-500/50 text-blue-200"
                  >
                    {trigger}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === prediction.id && (
              <>
                {/* AI Reasoning */}
                <div className="bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    AI Analysis
                  </h4>
                  <p className="text-sm text-gray-300">{prediction.reasoning}</p>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Strategic Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {prediction.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-green-400 mt-0.5" />
                        <span className="text-sm text-gray-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => onPredictionSelect?.(prediction)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Monitor This Prediction
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}