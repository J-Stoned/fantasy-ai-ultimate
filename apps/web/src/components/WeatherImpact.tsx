'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { weatherAPI, type GameWeather } from '@/lib/api/weather';
import { 
  Cloud, 
  Wind, 
  Thermometer, 
  Droplets,
  AlertTriangle,
  Check
} from 'lucide-react';

interface WeatherImpactProps {
  venue?: string;
  city?: string;
  state?: string;
  gameTime?: Date;
}

export function WeatherImpact({ venue, city, state, gameTime }: WeatherImpactProps) {
  const [weather, setWeather] = useState<GameWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let data: GameWeather | null = null;
        
        if (venue) {
          data = await weatherAPI.getVenueWeather(venue);
        } else if (city) {
          data = await weatherAPI.getCityWeather(city, state);
        }

        if (data) {
          setWeather(data);
          setInsights(weatherAPI.getWeatherInsights(data));
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [venue, city, state]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weather) {
    return null;
  }

  const getImpactColor = (impact: number) => {
    if (impact >= 0) return 'text-green-500';
    if (impact >= -0.2) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getImpactText = (impact: number) => {
    if (impact >= 0) return 'Minimal Impact';
    if (impact >= -0.2) return 'Moderate Impact';
    if (impact >= -0.4) return 'Significant Impact';
    return 'Severe Impact';
  };

  const getImpactProgress = (impact: number) => {
    // Convert -1 to 1 scale to 0-100
    return Math.round((1 + impact) * 50);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Weather Impact Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Conditions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {weather.temperature}°F (feels like {weather.feels_like}°F)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{weather.wind_speed} mph winds</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{weather.humidity}% humidity</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm capitalize">{weather.conditions}</span>
          </div>
        </div>

        {/* Impact Analysis */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-medium">Fantasy Impact</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Passing Game</span>
              <span className={`text-sm font-medium ${getImpactColor(weather.impact.passing)}`}>
                {getImpactText(weather.impact.passing)}
              </span>
            </div>
            <Progress value={getImpactProgress(weather.impact.passing)} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Kicking Game</span>
              <span className={`text-sm font-medium ${getImpactColor(weather.impact.kicking)}`}>
                {getImpactText(weather.impact.kicking)}
              </span>
            </div>
            <Progress value={getImpactProgress(weather.impact.kicking)} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall</span>
              <span className={`text-sm font-medium ${getImpactColor(weather.impact.overall)}`}>
                {getImpactText(weather.impact.overall)}
              </span>
            </div>
            <Progress value={getImpactProgress(weather.impact.overall)} className="h-2" />
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-medium">Key Insights</h4>
            {insights.map((insight, index) => (
              <Alert key={index} className="py-2">
                <AlertDescription className="text-sm flex items-start gap-2">
                  {insight.includes('Perfect') ? (
                    <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  )}
                  {insight}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}