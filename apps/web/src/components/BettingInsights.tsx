'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { oddsAPI, type OddsData } from '@/lib/api/odds';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Info
} from 'lucide-react';

interface BettingInsightsProps {
  sport?: string;
  teamName?: string;
}

export function BettingInsights({ sport = 'americanfootball_nfl', teamName }: BettingInsightsProps) {
  const [odds, setOdds] = useState<OddsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const fetchOdds = async () => {
      try {
        const data = await oddsAPI.getOdds(sport);
        
        // Filter by team if provided
        const filtered = teamName 
          ? data.filter(game => 
              game.homeTeam.includes(teamName) || 
              game.awayTeam.includes(teamName)
            )
          : data;

        setOdds(filtered);

        // Generate insights for each game
        const allInsights: string[] = [];
        filtered.forEach(game => {
          const gameInsights = oddsAPI.getBettingInsights(game);
          allInsights.push(...gameInsights);
        });
        setInsights(allInsights);
      } catch (error) {
        console.error('Error fetching odds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOdds();
  }, [sport, teamName]);

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const getSpreadColor = (spread: number) => {
    if (Math.abs(spread) > 7) return 'destructive';
    if (Math.abs(spread) > 3) return 'secondary';
    return 'default';
  };

  const getTotalBadge = (total: number) => {
    if (total > 50) return { variant: 'default' as const, text: 'High Scoring' };
    if (total < 40) return { variant: 'secondary' as const, text: 'Low Scoring' };
    return { variant: 'outline' as const, text: 'Average' };
  };

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

  if (odds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Betting Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No odds available at the moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Betting Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="lines" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lines">Lines</TabsTrigger>
            <TabsTrigger value="totals">Totals</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="lines" className="space-y-3">
            {odds.map(game => (
              <div key={game.gameId} className="space-y-2 p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {game.awayTeam} @ {game.homeTeam}
                  </span>
                  <Badge variant={getSpreadColor(game.consensus.spread.home)}>
                    {game.consensus.spread.home > 0 ? '+' : ''}{game.consensus.spread.home}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Spread</span>
                    <p className="font-medium">
                      {game.homeTeam} {formatOdds(game.consensus.spread.home)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ML</span>
                    <p className="font-medium">
                      {formatOdds(game.consensus.moneyline.home)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-medium">
                      {game.consensus.total.points}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="totals" className="space-y-3">
            {odds.map(game => {
              const totalBadge = getTotalBadge(game.consensus.total.points);
              const impliedScore = {
                home: (game.consensus.total.points / 2) - (game.consensus.spread.home / 2),
                away: (game.consensus.total.points / 2) + (game.consensus.spread.home / 2)
              };

              return (
                <div key={game.gameId} className="space-y-2 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {game.awayTeam} @ {game.homeTeam}
                    </span>
                    <Badge variant={totalBadge.variant}>
                      {totalBadge.text}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total O/U</span>
                      <span className="font-medium">{game.consensus.total.points}</span>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Implied {game.homeTeam}</span>
                        <span>{impliedScore.home.toFixed(1)} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Implied {game.awayTeam}</span>
                        <span>{impliedScore.away.toFixed(1)} pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="insights" className="space-y-3">
            {insights.length > 0 ? (
              insights.map((insight, index) => (
                <Alert key={index}>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{insight}</AlertDescription>
                </Alert>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No specific insights available
              </p>
            )}

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-medium mb-2">Fantasy Implications</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• High totals (50+) favor QBs and WRs</li>
                <li>• Low totals (&lt;40) favor RBs and DEF</li>
                <li>• Large spreads indicate game script concerns</li>
                <li>• Close spreads suggest competitive games</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 text-xs text-center text-muted-foreground">
          Powered by The Odds API • Consensus from 70+ sportsbooks
        </div>
      </CardContent>
    </Card>
  );
}