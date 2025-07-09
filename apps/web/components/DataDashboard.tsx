'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LiveScores } from './LiveScores';
import { WeatherImpact } from './WeatherImpact';
import { RedditSentiment } from './RedditSentiment';
import { BettingInsights } from './BettingInsights';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Zap, 
  Cloud, 
  MessageSquare, 
  DollarSign,
  TrendingUp,
  Brain
} from 'lucide-react';

export function DataDashboard() {
  const [searchPlayer, setSearchPlayer] = useState('');
  const [activePlayer, setActivePlayer] = useState('');

  const handleSearch = () => {
    if (searchPlayer.trim()) {
      setActivePlayer(searchPlayer.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Fantasy AI Data Hub</h1>
        </div>
        <p className="text-muted-foreground">
          Real-time insights from ESPN, Reddit, Weather, and Betting markets - all FREE!
        </p>

        {/* Player Search */}
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="Search for a player..."
            value={searchPlayer}
            onChange={(e) => setSearchPlayer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Analyze
          </Button>
        </div>
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scores">Live Scores</TabsTrigger>
          <TabsTrigger value="weather">Weather</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="betting">Betting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Live Games</CardTitle>
                <Zap className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">NFL games today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weather Alerts</CardTitle>
                <Cloud className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">Games affected</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trending Players</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8</div>
                <p className="text-xs text-muted-foreground">Hot on Reddit</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Value Plays</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">Based on odds</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <LiveScores />
            <RedditSentiment playerName={activePlayer} />
            <WeatherImpact city="Green Bay" state="WI" />
            <BettingInsights />
          </div>
        </TabsContent>

        <TabsContent value="scores">
          <LiveScores />
        </TabsContent>

        <TabsContent value="weather">
          <div className="grid gap-4 md:grid-cols-2">
            <WeatherImpact venue="lambeau" />
            <WeatherImpact venue="soldier" />
            <WeatherImpact venue="metlife" />
            <WeatherImpact venue="gillette" />
          </div>
        </TabsContent>

        <TabsContent value="sentiment">
          <RedditSentiment playerName={activePlayer} />
        </TabsContent>

        <TabsContent value="betting">
          <BettingInsights />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Powered by FREE APIs: ESPN • Reddit • OpenWeather • The Odds API
      </div>
    </div>
  );
}