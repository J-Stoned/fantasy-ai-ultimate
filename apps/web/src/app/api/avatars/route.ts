import { NextRequest, NextResponse } from 'next/server';
import { playerDataService } from '@/lib/database/player-data-service';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { logger } from '../../../lib/logging/logger';

// Schema for avatar upload
const AvatarUploadSchema = z.object({
  playerId: z.string().uuid(),
  avatarType: z.enum(['3d', '2d', 'photo']),
  fileUrl: z.string().url().optional(),
  fileData: z.string().optional(), // Base64 encoded file
  metadata: z.object({
    jerseyNumber: z.string().optional(),
    teamColors: z.array(z.string()).optional(),
    animationSet: z.string().optional(),
  }).optional()
});

// Schema for bulk avatar generation
const BulkAvatarGenerationSchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL']),
  tierFilter: z.enum(['star', 'starter', 'bench']).optional(),
  limit: z.number().min(1).max(1000).default(100),
  generateType: z.enum(['3d', '2d', 'photo', 'all']).default('all')
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const playerId = searchParams.get('playerId');
    const tiers = searchParams.get('tier')?.split(',');
    const sport = searchParams.get('sport')?.toUpperCase();
    const positions = searchParams.get('positions')?.split(',');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStats = searchParams.get('includeStats') === 'true';
    
    logger.info('Avatar API request', { 
      playerId, 
      tiers, 
      sport, 
      positions, 
      limit, 
      includeStats 
    });
    
    // If requesting specific player
    if (playerId) {
      const { data: player, error } = await playerDataService.getPlayerById(
        parseInt(playerId), 
        { include_stats: includeStats }
      );
      
      if (error) {
        return NextResponse.json({ error: error }, { status: 400 });
      }
      
      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
      
      const avatarData = {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team_abbreviation || player.team,
        sport: player.sport,
        
        // Avatar system data
        avatarTier: player.avatar_tier || 'practice',
        avatar2dUrl: player.avatar_2d_url,
        avatar3dUrl: player.avatar_3d_url,
        avatarPhotoUrl: player.avatar_photo_url,
        imageUrl: player.image_url,
        overallRating: player.overall_rating,
        avatarMetadata: player.avatar_metadata,
        
        // Performance data for avatar tier calculation
        avgFantasyPoints: player.season_stats?.avg_fantasy_points,
        consistency: player.season_stats?.consistency_score,
        trending: player.trending,
        
        // Player metadata
        age: player.age,
        college: player.college,
        jerseyNumber: player.jersey_number,
        draftYear: player.draft_year,
        draftRound: player.draft_round
      };
      
      return NextResponse.json({ 
        avatar: avatarData,
        success: true
      });
    }
    
    // Get players based on filters
    const { data: players, error } = await playerDataService.getPlayers({
      sport,
      positions,
      avatar_tiers: tiers,
      include_stats: includeStats,
      limit
    });
    
    if (error) {
      return NextResponse.json({ error: error }, { status: 400 });
    }
    
    if (!players || players.length === 0) {
      return NextResponse.json({ 
        avatars: [],
        count: 0,
        message: 'No players found with specified criteria'
      });
    }
    
    // Transform to avatar format
    const avatars = players.map(player => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team_abbreviation || player.team,
      sport: player.sport,
      
      // Avatar system data
      avatarTier: player.avatar_tier || 'practice',
      avatar2dUrl: player.avatar_2d_url,
      avatar3dUrl: player.avatar_3d_url,
      avatarPhotoUrl: player.avatar_photo_url,
      imageUrl: player.image_url,
      overallRating: player.overall_rating,
      avatarMetadata: player.avatar_metadata,
      
      // Performance-based avatar info
      avgFantasyPoints: player.season_stats?.avg_fantasy_points || 0,
      consistency: player.season_stats?.consistency_score || 0,
      trending: player.trending || 'stable',
      gamesPlayed: player.season_stats?.games_played || 0,
      
      // Player metadata
      age: player.age,
      college: player.college,
      jerseyNumber: player.jersey_number,
      draftYear: player.draft_year,
      draftRound: player.draft_round,
      
      // Avatar quality indicators
      hasAvatars: {
        has2D: !!player.avatar_2d_url,
        has3D: !!player.avatar_3d_url,
        hasPhoto: !!player.avatar_photo_url || !!player.image_url,
        completeness: [
          !!player.avatar_2d_url,
          !!player.avatar_3d_url,
          !!(player.avatar_photo_url || player.image_url)
        ].filter(Boolean).length / 3
      }
    }));
    
    // Sort by avatar tier priority and overall rating
    const tierOrder = { 'star': 4, 'starter': 3, 'bench': 2, 'practice': 1 };
    avatars.sort((a, b) => {
      const tierDiff = (tierOrder[b.avatarTier as keyof typeof tierOrder] || 0) - 
                      (tierOrder[a.avatarTier as keyof typeof tierOrder] || 0);
      if (tierDiff !== 0) return tierDiff;
      return (b.overallRating || 0) - (a.overallRating || 0);
    });
    
    // Calculate aggregate stats
    const tierCounts = avatars.reduce((counts, avatar) => {
      counts[avatar.avatarTier] = (counts[avatar.avatarTier] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const avgCompleteness = avatars.reduce((sum, a) => sum + a.hasAvatars.completeness, 0) / avatars.length;
    
    logger.info('Avatar API response', {
      totalAvatars: avatars.length,
      tierCounts,
      avgCompleteness: Number(avgCompleteness.toFixed(2)),
      sport,
      filters: { tiers, positions }
    });
    
    return NextResponse.json({ 
      avatars,
      count: avatars.length,
      metadata: {
        sport,
        tierCounts,
        avgCompleteness: Number(avgCompleteness.toFixed(2)),
        filters: {
          tiers,
          positions,
          sport
        },
        dataSource: '1.57M game stats dataset'
      }
    });
    
  } catch (error) {
    logger.error('Avatar fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch avatars',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate input
    const validatedData = AvatarUploadSchema.parse(body);
    
    // Check if user has permission to upload avatars
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Handle file upload if base64 data provided
    let fileUrl = validatedData.fileUrl;
    if (validatedData.fileData) {
      // Upload to Supabase Storage
      const fileExt = validatedData.avatarType === '3d' ? 'glb' : 
                      validatedData.avatarType === '2d' ? 'png' : 'jpg';
      const fileName = `${validatedData.playerId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${validatedData.avatarType}/${fileName}`;
      
      // Convert base64 to buffer
      const base64Data = validatedData.fileData.replace(/^data:.*,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('player-avatars')
        .upload(filePath, buffer, {
          contentType: `image/${fileExt}`,
          upsert: true
        });
      
      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('player-avatars')
        .getPublicUrl(filePath);
      
      fileUrl = publicUrl;
    }
    
    // Update player avatar URL
    const updateField = validatedData.avatarType === '3d' ? 'avatar_3d_url' :
                       validatedData.avatarType === '2d' ? 'avatar_2d_url' :
                       'avatar_photo_url';
    
    const { data, error } = await supabase
      .from('players')
      .update({
        [updateField]: fileUrl,
        avatar_metadata: validatedData.metadata || {}
      })
      .eq('id', validatedData.playerId)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Also create/update asset record
    await supabase
      .from('player_avatar_assets')
      .upsert({
        player_id: validatedData.playerId,
        asset_type: validatedData.avatarType === '3d' ? '3d_model' :
                    validatedData.avatarType === '2d' ? '2d_sprite' : 'photo',
        file_url: fileUrl,
        mime_type: validatedData.avatarType === '3d' ? 'model/gltf-binary' :
                   validatedData.avatarType === '2d' ? 'image/png' : 'image/jpeg',
        metadata: validatedData.metadata || {}
      }, {
        onConflict: 'player_id,asset_type'
      });
    
    return NextResponse.json({ 
      message: 'Avatar uploaded successfully',
      player: data 
    });
    
  } catch (error) {
    logger.error('Avatar upload error:', { error: error });
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.errors : 'Failed to upload avatar' },
      { status: 400 }
    );
  }
}

// Bulk generate avatars using AI
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate input
    const validatedData = BulkAvatarGenerationSchema.parse(body);
    
    // Check admin permission
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch players needing avatars
    let query = supabase
      .from('players')
      .select('id, first_name, last_name, position, jersey_number, overall_rating, current_team_id')
      .limit(validatedData.limit);
    
    if (validatedData.tierFilter) {
      if (validatedData.tierFilter === 'star') {
        query = query.gte('overall_rating', 90);
      } else if (validatedData.tierFilter === 'starter') {
        query = query.gte('overall_rating', 75).lt('overall_rating', 90);
      } else {
        query = query.lt('overall_rating', 75);
      }
    }
    
    // Filter by missing avatars
    if (validatedData.generateType !== 'all') {
      const nullField = validatedData.generateType === '3d' ? 'avatar_3d_url' :
                       validatedData.generateType === '2d' ? 'avatar_2d_url' :
                       'avatar_photo_url';
      query = query.is(nullField, null);
    }
    
    const { data: players, error } = await query;
    
    if (error || !players) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 400 });
    }
    
    // Here you would integrate with an AI service to generate avatars
    // For now, we'll just return the players that need avatars
    
    const avatarTasks = players.map(player => {
      const tier = player.overall_rating >= 90 ? 'star' :
                   player.overall_rating >= 75 ? 'starter' : 'bench';
      
      return {
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`,
        position: player.position?.[0] || 'Unknown',
        tier,
        requiredAvatars: {
          needs3D: tier === 'star' && validatedData.generateType !== '2d' && validatedData.generateType !== 'photo',
          needs2D: tier !== 'bench' && validatedData.generateType !== '3d' && validatedData.generateType !== 'photo',
          needsPhoto: validatedData.generateType !== '3d' && validatedData.generateType !== '2d'
        }
      };
    });
    
    return NextResponse.json({
      message: 'Avatar generation tasks prepared',
      totalPlayers: avatarTasks.length,
      tasks: avatarTasks,
      estimatedTime: `${Math.ceil(avatarTasks.length * 0.5)} minutes`,
      aiServiceRequired: true,
      suggestedServices: [
        'Stable Diffusion for 2D sprites',
        'Kaedim3D or Meshy for 3D models',
        'This Person Does Not Exist API for photos'
      ]
    });
    
  } catch (error) {
    logger.error('Bulk generation error:', { error: error });
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.errors : 'Failed to generate avatars' },
      { status: 400 }
    );
  }
}