'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { espnAPI } from '@/lib/api/espn-free';
import { format } from 'date-fns';
import { RefreshCw, Zap, Clock } from 'lucide-react';

interface Game {
  id: string;
  status: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: string;
    logo?: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: string;
    logo?: string;
  };
  quarter?: string;
  timeRemaining?: string;
}

export function LiveScores() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchScores = async () => {
    try {
      const data = await espnAPI.getNFLScoreboard();
      
      // Parse ESPN data to our format
      const parsedGames = data.events?.map((event: any) => {
        const competition = event.competitions[0];
        const home = competition.competitors.find((c: any) => c.homeAway === 'home');
        const away = competition.competitors.find((c: any) => c.homeAway === 'away');
        
        return {
          id: event.id,
          status: competition.status.type.description,
          homeTeam: {
            name: home.team.displayName,
            abbreviation: home.team.abbreviation,
            score: home.score,
            logo: home.team.logo,
          },
          awayTeam: {
            name: away.team.displayName,
            abbreviation: away.team.abbreviation,
            score: away.score,
            logo: away.team.logo,
          },
          quarter: competition.status.period,
          timeRemaining: competition.status.displayClock,
        };
      }) || [];

      setGames(parsedGames);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching scores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    if (status.includes('Final')) return 'secondary';
    if (status.includes('Halftime')) return 'warning';
    return 'success';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Live NFL Scores
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {format(lastUpdate, 'h:mm a')}
          <button
            onClick={fetchScores}
            className="ml-2 hover:text-foreground transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && games.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : games.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No games currently active
          </p>
        ) : (
          <div className="space-y-3">
            {games.map(game => (
              <div
                key={game.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex flex-col items-end text-right">
                    <span className="font-medium">{game.awayTeam.abbreviation}</span>
                    <span className="text-2xl font-bold">{game.awayTeam.score}</span>
                  </div>
                  <div className="text-muted-foreground">@</div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{game.homeTeam.abbreviation}</span>
                    <span className="text-2xl font-bold">{game.homeTeam.score}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={getStatusColor(game.status)}>
                    {game.status}
                  </Badge>
                  {game.timeRemaining && game.status !== 'Final' && (
                    <span className="text-xs text-muted-foreground">
                      Q{game.quarter} - {game.timeRemaining}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-xs text-center text-muted-foreground">
          Powered by ESPN Free API • Updates every 30s
        </div>
      </CardContent>
    </Card>
  );
}