import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Test 1: Check if players table exists and has image_url column
    const { data: samplePlayer, error: sampleError } = await supabase
      .from('players')
      .select('*')
      .eq('sport', 'NFL')
      .limit(1)
      .single();
    
    const hasImageUrl = samplePlayer && 'image_url' in samplePlayer;
    
    // Test 2: Get some NFL players with positions
    const { data: nflPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, name, first_name, last_name, position, team, current_team, image_url, sport')
      .eq('sport', 'NFL')
      .in('position', ['QB', 'RB', 'WR', 'TE'])
      .limit(10);
    
    // Test 3: Check player_game_logs join
    const { data: gameLogsWithPlayers, error: joinError } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        fantasy_points_ppr,
        week,
        players (
          id,
          name,
          position,
          team,
          image_url
        )
      `)
      .eq('players.sport', 'NFL')
      .gte('week', 1)
      .limit(5);
    
    return NextResponse.json({
      success: true,
      tests: {
        hasImageUrlColumn: hasImageUrl,
        samplePlayer: samplePlayer ? {
          ...samplePlayer,
          hasImageUrl: !!samplePlayer.image_url
        } : null,
        nflPlayersFound: nflPlayers?.length || 0,
        nflPlayersSample: nflPlayers?.slice(0, 3),
        gameLogsJoinWorks: !joinError && gameLogsWithPlayers?.length > 0,
        gameLogsSample: gameLogsWithPlayers?.slice(0, 2)
      },
      errors: {
        sampleError: sampleError?.message,
        playersError: playersError?.message,
        joinError: joinError?.message
      }
    });
    
  } catch (error) {
    logger.error('Failed to test player images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test player images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}