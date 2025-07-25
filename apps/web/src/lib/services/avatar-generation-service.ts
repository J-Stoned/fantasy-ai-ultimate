import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { logger } from '../logging/logger';

interface AvatarGenerationOptions {
  playerId: string;
  playerName: string;
  position: string;
  jerseyNumber?: string;
  teamColors?: string[];
  tier: 'star' | 'starter' | 'bench';
}

export class AvatarGenerationService {
  private supabase;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  /**
   * Generate all avatar types for a player
   */
  async generatePlayerAvatars(options: AvatarGenerationOptions) {
    const results = {
      photo: null as string | null,
      sprite2D: null as string | null,
      model3D: null as string | null,
      success: false,
      errors: [] as string[]
    };
    
    try {
      // Generate based on tier
      if (options.tier === 'star') {
        // Generate all three types for star players
        results.photo = await this.generatePhotoAvatar(options);
        results.sprite2D = await this.generate2DSprite(options);
        results.model3D = await this.generate3DModel(options);
      } else if (options.tier === 'starter') {
        // Generate photo and 2D sprite for starters
        results.photo = await this.generatePhotoAvatar(options);
        results.sprite2D = await this.generate2DSprite(options);
      } else {
        // Only photo for bench players
        results.photo = await this.generatePhotoAvatar(options);
      }
      
      // Update player record with generated URLs
      await this.updatePlayerAvatars(options.playerId, results);
      
      results.success = true;
    } catch (error) {
      logger.error('Avatar generation failed:', { error: error });
      results.errors.push(error.message);
    }
    
    return results;
  }
  
  /**
   * Generate a photo avatar using placeholder service or AI
   */
  private async generatePhotoAvatar(options: AvatarGenerationOptions): Promise<string> {
    // For MVP, use a placeholder service
    // In production, integrate with AI portrait generation
    
    const seed = `${options.playerName}-${options.playerId}`;
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}&size=512`;
    
    // Download and optimize the image
    const response = await fetch(photoUrl);
    const buffer = await response.arrayBuffer();
    
    // Optimize with sharp
    const optimized = await sharp(Buffer.from(buffer))
      .resize(512, 512)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    
    // Upload to Supabase Storage
    const fileName = `${options.playerId}-photo.jpg`;
    const { data, error } = await this.supabase.storage
      .from('player-avatars')
      .upload(`photos/${fileName}`, optimized, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = this.supabase.storage
      .from('player-avatars')
      .getPublicUrl(`photos/${fileName}`);
    
    return publicUrl;
  }
  
  /**
   * Generate a 2D sprite for starter tier players
   */
  private async generate2DSprite(options: AvatarGenerationOptions): Promise<string> {
    // Create a canvas-based sprite with position-specific styling
    const canvas = this.create2DCanvas(options);
    
    // Convert canvas to buffer
    const buffer = canvas.toBuffer('png');
    
    // Optimize with sharp
    const optimized = await sharp(buffer)
      .resize(256, 256)
      .png({ compressionLevel: 9 })
      .toBuffer();
    
    // Upload to storage
    const fileName = `${options.playerId}-sprite.png`;
    const { data, error } = await this.supabase.storage
      .from('player-avatars')
      .upload(`2d/${fileName}`, optimized, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = this.supabase.storage
      .from('player-avatars')
      .getPublicUrl(`2d/${fileName}`);
    
    return publicUrl;
  }
  
  /**
   * Generate or prepare 3D model for star players
   */
  private async generate3DModel(options: AvatarGenerationOptions): Promise<string> {
    // For MVP, use a template 3D model with customization
    // In production, integrate with AI 3D generation services
    
    const templatePath = this.get3DTemplate(options.position);
    
    // Load and customize the template
    const customizedModel = await this.customize3DModel(templatePath, options);
    
    // Upload to storage
    const fileName = `${options.playerId}-model.glb`;
    const { data, error } = await this.supabase.storage
      .from('player-avatars')
      .upload(`3d/${fileName}`, customizedModel, {
        contentType: 'model/gltf-binary',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = this.supabase.storage
      .from('player-avatars')
      .getPublicUrl(`3d/${fileName}`);
    
    return publicUrl;
  }
  
  /**
   * Create 2D sprite using canvas
   */
  private create2DCanvas(options: AvatarGenerationOptions): any {
    // This would use node-canvas or similar
    // For now, returning placeholder
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = options.teamColors?.[0] || '#333';
    ctx.fillRect(0, 0, 256, 256);
    
    // Jersey number
    if (options.jerseyNumber) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 120px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.jerseyNumber, 128, 128);
    }
    
    // Position badge
    ctx.fillStyle = options.teamColors?.[1] || '#666';
    ctx.fillRect(0, 200, 256, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(options.position, 128, 228);
    
    return canvas;
  }
  
  /**
   * Get 3D template based on position
   */
  private get3DTemplate(position: string): string {
    const templates = {
      QB: '/templates/3d/quarterback.glb',
      RB: '/templates/3d/runningback.glb',
      WR: '/templates/3d/widereceiver.glb',
      TE: '/templates/3d/tightend.glb',
      // Add more positions
      DEFAULT: '/templates/3d/default-player.glb'
    };
    
    return templates[position] || templates.DEFAULT;
  }
  
  /**
   * Customize 3D model with team colors and jersey number
   */
  private async customize3DModel(
    templatePath: string, 
    options: AvatarGenerationOptions
  ): Promise<Buffer> {
    // This would load the GLB, modify materials/textures, and export
    // For MVP, return the template as-is
    const response = await fetch(templatePath);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }
  
  /**
   * Update player record with generated avatar URLs
   */
  private async updatePlayerAvatars(
    playerId: string, 
    results: any
  ) {
    const updateData: any = {};
    
    if (results.photo) {
      updateData.avatar_photo_url = results.photo;
    }
    
    if (results.sprite2D) {
      updateData.avatar_2d_url = results.sprite2D;
    }
    
    if (results.model3D) {
      updateData.avatar_3d_url = results.model3D;
    }
    
    updateData.avatar_metadata = {
      generated_at: new Date().toISOString(),
      generation_method: 'ai_assisted'
    };
    
    const { error } = await this.supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);
    
    if (error) {
      logger.error('Failed to update player avatars:', { error: error });
    }
  }
  
  /**
   * Batch generate avatars for multiple players
   */
  async batchGenerateAvatars(
    playerIds: string[], 
    options?: { tier?: string; limit?: number }
  ) {
    const results = [];
    const batchSize = 10; // Process 10 at a time
    
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batch = playerIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (playerId) => {
        // Fetch player data
        const { data: player } = await this.supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .single();
        
        if (!player) return null;
        
        return this.generatePlayerAvatars({
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          position: player.position?.[0] || 'Unknown',
          jerseyNumber: player.jersey_number,
          teamColors: player.team_colors,
          tier: player.avatar_tier || 'bench'
        });
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
}

// Export singleton instance
export const avatarGenerationService = new AvatarGenerationService();