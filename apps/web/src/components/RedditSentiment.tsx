'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { redditAPI, type RedditPost, type PlayerSentiment } from '@/lib/api/reddit';
import { formatDistanceToNow } from 'date-fns';
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface RedditSentimentProps {
  playerName?: string;
  teamName?: string;
}

export function RedditSentiment({ playerName, teamName }: RedditSentimentProps) {
  const [sentiment, setSentiment] = useState<PlayerSentiment | null>(null);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sentiment');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (playerName) {
          const [sentimentData, playerPosts] = await Promise.all([
            redditAPI.getPlayerSentiment(playerName),
            redditAPI.searchPlayer(playerName, 10)
          ]);
          setSentiment(sentimentData);
          setPosts(playerPosts);
        } else if (teamName) {
          const teamPosts = await redditAPI.getTeamPosts(teamName);
          setPosts(teamPosts);
        } else {
          // Get trending players
          const trendingPlayers = await redditAPI.getTrendingPlayers();
          setTrending(trendingPlayers);
          
          // Get hot fantasy football posts
          const hotPosts = await redditAPI.getFantasyFootballPosts();
          setPosts(hotPosts);
        }
      } catch (error) {
        console.error('Error fetching Reddit data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [playerName, teamName]);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'mixed':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return 'text-green-500';
    if (score < -0.2) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getScoreIcon = (score: number) => {
    if (score > 100) return <Flame className="h-4 w-4 text-orange-500" />;
    if (score > 50) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (score < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return null;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Reddit Community Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
            <TabsTrigger value="posts">Recent Posts</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
          </TabsList>

          <TabsContent value="sentiment" className="space-y-4">
            {sentiment ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSentimentIcon(sentiment.sentiment)}
                    <span className="font-medium capitalize">{sentiment.sentiment} Sentiment</span>
                  </div>
                  <Badge variant="secondary">{sentiment.mentions} mentions</Badge>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Community Score</span>
                      <span className={`font-medium ${getSentimentColor(sentiment.score)}`}>
                        {(sentiment.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          sentiment.score > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.abs(sentiment.score) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {sentiment.topics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Hot Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {sentiment.topics.map(topic => (
                        <Badge key={topic} variant="outline">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Select a player to see sentiment analysis
              </p>
            )}
          </TabsContent>

          <TabsContent value="posts">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {posts.slice(0, 10).map(post => (
                  <div key={post.id} className="space-y-1 p-3 rounded-lg border">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium line-clamp-2 flex-1">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {getScoreIcon(post.score)}
                        <span className="text-xs">{post.score}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>r/{post.flair || 'fantasyfootball'}</span>
                      <span>{post.num_comments} comments</span>
                      <span>{formatDistanceToNow(new Date(post.created_utc * 1000))} ago</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="trending">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Trending Players</h4>
              {trending.length > 0 ? (
                <div className="space-y-2">
                  {trending.map((player, index) => (
                    <div key={player} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="font-medium">{player}</span>
                      </div>
                      <Badge variant="secondary">
                        <Flame className="h-3 w-3 mr-1" />
                        Hot
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No trending players at the moment
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 text-xs text-center text-muted-foreground">
          Powered by Reddit API • Community-driven insights
        </div>
      </CardContent>
    </Card>
  );
}