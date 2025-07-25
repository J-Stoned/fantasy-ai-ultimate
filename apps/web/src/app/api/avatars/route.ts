import { NextRequest, NextResponse } from 'next/server';
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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const playerId = searchParams.get('playerId');
    const tier = searchParams.get('tier');
    const sport = searchParams.get('sport');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build query
    let query = supabase
      .from('player_avatars_view')
      .select('*');
    
    if (playerId) {
      query = query.eq('id', playerId);
    }
    
    if (tier) {
      query = query.eq('avatar_tier', tier);
    }
    
    if (sport) {
      // You'd need to join with teams table for sport filtering
      query = query.eq('sport', sport);
    }
    
    query = query.limit(limit);
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      avatars: data,
      count: data?.length || 0
    });
    
  } catch (error) {
    logger.error('Avatar fetch error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch avatars' },
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