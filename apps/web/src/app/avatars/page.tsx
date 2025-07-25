import { Metadata } from 'next';
import { AvatarGallery } from '@/components/avatars/AvatarGallery';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Star, Users, Trophy } from 'lucide-react';
import { logger } from '../../lib/logging/logger';

export const metadata: Metadata = {
  title: 'Player Avatars | Fantasy AI',
  description: 'Explore our revolutionary 3D and 2D player avatar system',
};

// Mock star players for showcase
const showcasePlayers = [
  { id: 'mahomes-15', name: 'Patrick Mahomes', position: 'QB', team: 'KC', rating: 98 },
  { id: 'mccaffrey-22', name: 'Christian McCaffrey', position: 'RB', team: 'SF', rating: 97 },
  { id: 'jefferson-18', name: 'Justin Jefferson', position: 'WR', team: 'MIN', rating: 96 },
  { id: 'kelce-87', name: 'Travis Kelce', position: 'TE', team: 'KC', rating: 95 },
];

export default function AvatarsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Player Avatar System
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Experience fantasy sports like never before with our revolutionary avatar system. 
          From stunning 3D models for star players to optimized 2D avatars for your entire roster.
        </p>
      </div>

      {/* Tier Showcase */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Star Players (3D)
            </CardTitle>
            <CardDescription>
              Top 500 players with full 3D avatars
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <PlayerAvatar playerId="mahomes-15" size={120} />
                  <Badge className="absolute -bottom-2 -right-2 bg-yellow-500">
                    98 Rating
                  </Badge>
                </div>
              </div>
              <ul className="text-sm space-y-1">
                <li>✨ Full 3D models with animations</li>
                <li>🎮 Interactive orbit controls (Pro+)</li>
                <li>🏆 Custom celebrations</li>
                <li>💫 Real-time performance effects</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-400/50 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Starter Players (2D)
            </CardTitle>
            <CardDescription>
              5,000 starting players with enhanced 2D avatars
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <PlayerAvatar playerId="starter-example" size={120} force2D />
                  <Badge className="absolute -bottom-2 -right-2 bg-gray-500">
                    82 Rating
                  </Badge>
                </div>
              </div>
              <ul className="text-sm space-y-1">
                <li>🖼️ High-quality 2D avatars</li>
                <li>🎨 Team color customization</li>
                <li>📊 Performance indicators</li>
                <li>⚡ Optimized loading</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              Bench Players (Photos)
            </CardTitle>
            <CardDescription>
              80,000+ players with standard photos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <PlayerAvatar playerId="bench-example" size={120} force2D />
                  <Badge className="absolute -bottom-2 -right-2 bg-orange-500">
                    68 Rating
                  </Badge>
                </div>
              </div>
              <ul className="text-sm space-y-1">
                <li>📸 Official player photos</li>
                <li>🏷️ Tier badges</li>
                <li>📈 Basic stat overlays</li>
                <li>🚀 Instant loading</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Star Players Showcase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Featured Star Players
          </CardTitle>
          <CardDescription>
            Experience our premium 3D avatars with these elite players
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {showcasePlayers.map(player => (
              <div key={player.id} className="text-center space-y-2">
                <PlayerAvatar playerId={player.id} size={100} showStats />
                <div>
                  <p className="font-semibold">{player.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {player.position} • {player.team}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Player Avatar Gallery</CardTitle>
          <CardDescription>
            Browse and explore our complete avatar collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarGallery 
            onPlayerSelect={(player) => {
              logger.info('Selected player:', { data: player });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}