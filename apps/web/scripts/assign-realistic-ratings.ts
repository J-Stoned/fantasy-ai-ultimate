#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Initialize PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fantasy_ai',
  user: process.env.DB_USER || 'fantasy_user',
  password: process.env.DB_PASSWORD || 'fantasy_password',
  max: 20,
});

console.log('🎯 INTELLIGENT PLAYER RATING ASSIGNMENT');
console.log('================================================');

// Target distribution based on 85k players
const TARGET_DISTRIBUTION = {
  star: 500,     // Top 500 players (90+ rating) 
  starter: 5000, // Next 5,000 players (75-89 rating)
  bench: 79631   // Everyone else (60-74 rating)
};

async function analyzePlayerStats() {
  console.log('📊 Analyzing player performance data using actual DFS points...\n');
  
  // Get players with game statistics using correct column names
  const statsQuery = `
    SELECT 
      p.id,
      p.firstname,
      p.lastname,
      p.position,
      p.sport_id,
      p.team_abbreviation,
      COUNT(pgs.id) as games_played,
      AVG(CASE 
        WHEN pgs.dk_points IS NOT NULL AND pgs.dk_points > 0 
        THEN pgs.dk_points 
        ELSE NULL 
      END) as avg_dk_points,
      AVG(CASE 
        WHEN pgs.fd_points IS NOT NULL AND pgs.fd_points > 0 
        THEN pgs.fd_points 
        ELSE NULL 
      END) as avg_fd_points,
      MAX(GREATEST(
        COALESCE(pgs.dk_points, 0), 
        COALESCE(pgs.fd_points, 0),
        COALESCE(pgs.yahoo_points, 0)
      )) as max_points,
      COUNT(CASE WHEN GREATEST(
        COALESCE(pgs.dk_points, 0), 
        COALESCE(pgs.fd_points, 0)
      ) > 20 THEN 1 END) as big_games,
      AVG(pgs.minutes_played) as avg_minutes
    FROM players p
    LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
    WHERE p.sport_id IN ('football', 'basketball', 'baseball', 'hockey')
    GROUP BY p.id, p.firstname, p.lastname, p.position, p.sport_id, p.team_abbreviation
    HAVING COUNT(pgs.id) > 0  -- Only players with stats
    ORDER BY 
      COALESCE(AVG(CASE WHEN pgs.dk_points IS NOT NULL AND pgs.dk_points > 0 THEN pgs.dk_points END), 0) DESC,
      COUNT(pgs.id) DESC
  `;
  
  const result = await pool.query(statsQuery);
  console.log(`🏆 Found ${result.rows.length} players with performance data`);
  
  return result.rows;
}

async function assignIntelligentRatings() {
  const playersWithStats = await analyzePlayerStats();
  
  if (playersWithStats.length === 0) {
    console.log('⚠️  No players with stats found, using positional ratings instead...');
    return await assignPositionalRatings();
  }
  
  console.log('\n⭐ Assigning ratings based on performance...');
  
  // Calculate performance scores and assign tiers
  const playerUpdates = playersWithStats.map((player, index) => {
    let rating = 60; // Default
    let tier = 'bench';
    
    // Performance-based scoring using actual DFS points
    const avgDkPoints = player.avg_dk_points || 0;
    const avgFdPoints = player.avg_fd_points || 0;
    const avgPoints = Math.max(avgDkPoints, avgFdPoints); // Use best platform performance
    const gamesPlayed = player.games_played || 0;
    const bigGames = player.big_games || 0;
    const consistency = gamesPlayed > 10 ? (bigGames / gamesPlayed) : 0;
    
    // Sport-specific adjustments
    let multiplier = 1;
    switch (player.sport_id) {
      case 'football': multiplier = 1.2; break; // NFL premium
      case 'basketball': multiplier = 1.1; break; // NBA premium  
      case 'baseball': multiplier = 1.0; break;
      case 'hockey': multiplier = 0.9; break;
    }
    
    // Position-specific adjustments
    const positionBonus = ['QB', 'RB', 'WR', 'PG', 'SG', 'C'].includes(player.position) ? 5 : 0;
    
    // Calculate composite score
    const performanceScore = (avgPoints * multiplier) + (consistency * 10) + positionBonus;
    
    // Assign tiers based on ranking
    if (index < TARGET_DISTRIBUTION.star) {
      rating = Math.min(99, Math.max(90, 90 + Math.floor(performanceScore / 5)));
      tier = 'star';
    } else if (index < TARGET_DISTRIBUTION.star + TARGET_DISTRIBUTION.starter) {
      rating = Math.min(89, Math.max(75, 75 + Math.floor(performanceScore / 8)));
      tier = 'starter';
    } else {
      rating = Math.min(74, Math.max(60, 60 + Math.floor(performanceScore / 12)));
      tier = 'bench';
    }
    
    return {
      id: player.id,
      name: `${player.firstname} ${player.lastname}`,
      rating,
      tier,
      avgPoints: avgPoints?.toFixed(1) || '0.0',
      games: gamesPlayed
    };
  });
  
  // Update database in batches
  console.log('\n🔄 Updating player ratings in database...');
  
  let updated = 0;
  const batchSize = 500;
  
  for (let i = 0; i < playerUpdates.length; i += batchSize) {
    const batch = playerUpdates.slice(i, i + batchSize);
    
    for (const player of batch) {
      await pool.query(`
        UPDATE players 
        SET 
          overall_rating = $1,
          avatar_tier = $2,
          avatar_metadata = jsonb_set(
            COALESCE(avatar_metadata, '{}'),
            '{performance_based}',
            'true'
          )
        WHERE id = $3
      `, [player.rating, player.tier, player.id]);
      
      updated++;
      
      if (updated % 1000 === 0) {
        console.log(`✅ Updated ${updated} players...`);
      }
    }
  }
  
  console.log(`\n🎉 Updated ${updated} players with performance-based ratings!`);
  
  // Show some examples
  console.log('\n⭐ Top 10 Star Players:');
  playerUpdates.slice(0, 10).forEach((player, i) => {
    console.log(`${i + 1}. ${player.name} (${player.rating}) - ${player.avgPoints} avg pts, ${player.games} games`);
  });
  
  return updated;
}

async function assignPositionalRatings() {
  console.log('📍 Assigning ratings based on position and sport...');
  
  // Position tier rankings by sport
  const positionTiers = {
    football: {
      star: ['QB'],
      starter: ['RB', 'WR', 'TE'],
      bench: ['K', 'DST', 'OL', 'DL', 'LB', 'DB']
    },
    basketball: {
      star: ['PG', 'SG'],  
      starter: ['SF', 'PF', 'C'],
      bench: ['G', 'F']
    },
    baseball: {
      star: ['P', 'C'],
      starter: ['1B', '2B', '3B', 'SS', 'OF'],
      bench: ['DH', 'IF']
    },
    hockey: {
      star: ['C', 'LW', 'RW'],
      starter: ['D'],
      bench: ['G']
    }
  };
  
  // Get all players without stats
  const playersQuery = `
    SELECT id, position, sport_id, firstname, lastname
    FROM players 
    WHERE sport_id IN ('football', 'basketball', 'baseball', 'hockey')
    ORDER BY 
      CASE sport_id 
        WHEN 'football' THEN 1
        WHEN 'basketball' THEN 2  
        WHEN 'baseball' THEN 3
        WHEN 'hockey' THEN 4
        ELSE 5
      END,
      position,
      RANDOM()  -- Add randomness within positions
  `;
  
  const result = await pool.query(playersQuery);
  const players = result.rows;
  
  console.log(`📊 Assigning positional ratings for ${players.length} players...`);
  
  let starCount = 0, starterCount = 0, benchCount = 0;
  let updated = 0;
  
  for (const player of players) {
    const sport = player.sport_id;
    const position = player.position || 'UNKNOWN';
    
    let rating = 60;
    let tier = 'bench';
    
    // Determine tier based on position and current counts
    const tiers = positionTiers[sport];
    if (tiers) {
      if (tiers.star.includes(position) && starCount < TARGET_DISTRIBUTION.star) {
        rating = 90 + Math.floor(Math.random() * 9); // 90-98
        tier = 'star';
        starCount++;
      } else if (tiers.starter.includes(position) && starterCount < TARGET_DISTRIBUTION.starter) {
        rating = 75 + Math.floor(Math.random() * 14); // 75-88
        tier = 'starter';
        starterCount++;
      } else {
        rating = 60 + Math.floor(Math.random() * 14); // 60-73
        tier = 'bench';
        benchCount++;
      }
    }
    
    await pool.query(`
      UPDATE players 
      SET 
        overall_rating = $1,
        avatar_tier = $2,
        avatar_metadata = jsonb_set(
          COALESCE(avatar_metadata, '{}'),
          '{position_based}',
          'true'
        )
      WHERE id = $3
    `, [rating, tier, player.id]);
    
    updated++;
    
    if (updated % 2000 === 0) {
      console.log(`✅ Updated ${updated} players... (⭐${starCount} 🏃${starterCount} 🏃‍♂️${benchCount})`);
    }
  }
  
  console.log(`\n🎉 Assigned positional ratings: ⭐${starCount} stars, 🏃${starterCount} starters, 🏃‍♂️${benchCount} bench`);
  return updated;
}

async function showFinalDistribution() {
  console.log('\n📊 FINAL AVATAR TIER DISTRIBUTION:');
  console.log('================================================');
  
  const result = await pool.query(`
    SELECT 
      avatar_tier,
      COUNT(*) as count,
      MIN(overall_rating) as min_rating,
      MAX(overall_rating) as max_rating,
      AVG(overall_rating)::integer as avg_rating
    FROM players
    WHERE avatar_tier IS NOT NULL
    GROUP BY avatar_tier
    ORDER BY 
      CASE avatar_tier
        WHEN 'star' THEN 1
        WHEN 'starter' THEN 2  
        WHEN 'bench' THEN 3
      END
  `);
  
  result.rows.forEach(row => {
    const emoji = row.avatar_tier === 'star' ? '⭐' : row.avatar_tier === 'starter' ? '🏃' : '🏃‍♂️';
    console.log(`${emoji} ${row.avatar_tier.toUpperCase()}: ${row.count.toLocaleString()} players (${row.min_rating}-${row.max_rating} rating, avg: ${row.avg_rating})`);
  });
}

// Main execution
async function main() {
  try {
    await pool.query('SELECT 1'); // Test connection
    console.log('✅ Connected to database\n');
    
    // Check current state
    const currentResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN avatar_tier = 'star' THEN 1 END) as stars,
        COUNT(CASE WHEN avatar_tier = 'starter' THEN 1 END) as starters
      FROM players
    `);
    
    const current = currentResult.rows[0];
    console.log(`📊 Current state: ${current.total} total, ${current.stars} stars, ${current.starters} starters\n`);
    
    if (current.stars < 400 || current.starters < 4000) {
      console.log('🔄 Need to reassign ratings for proper distribution...\n');
      
      // Try performance-based assignment first
      const updated = await assignIntelligentRatings();
      
      // Fill remaining slots with positional ratings if needed
      const newResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN avatar_tier = 'star' THEN 1 END) as stars,
          COUNT(CASE WHEN avatar_tier = 'starter' THEN 1 END) as starters
        FROM players
      `);
      
      const newCounts = newResult.rows[0];
      if (newCounts.stars < TARGET_DISTRIBUTION.star || newCounts.starters < TARGET_DISTRIBUTION.starter) {
        console.log('\n🔄 Filling remaining slots with positional ratings...');
        await assignPositionalRatings();
      }
    }
    
    await showFinalDistribution();
    
    console.log('\n✨ Rating assignment complete!');
    console.log('\n🎯 Next steps:');
    console.log('1. Avatar URLs are already populated');
    console.log('2. Ready to test the web application');
    console.log('3. Star players will get 3D avatars');
    console.log('4. Starter players will get 2D avatars');
    console.log('5. Bench players will get photo avatars');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

main();