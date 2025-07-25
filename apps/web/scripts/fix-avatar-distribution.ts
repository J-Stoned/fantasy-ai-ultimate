#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fantasy_ai',
  user: process.env.DB_USER || 'fantasy_user',
  password: process.env.DB_PASSWORD || 'fantasy_password',
  max: 20,
});

console.log('🎯 FIXING AVATAR TIER DISTRIBUTION');
console.log('================================================');

async function fixDistribution() {
  try {
    await pool.query('BEGIN');
    
    console.log('📊 Current distribution:');
    const currentResult = await pool.query(`
      SELECT 
        avatar_tier,
        COUNT(*) as count
      FROM players
      GROUP BY avatar_tier
      ORDER BY 
        CASE avatar_tier
          WHEN 'star' THEN 1
          WHEN 'starter' THEN 2  
          WHEN 'bench' THEN 3
        END
    `);
    
    currentResult.rows.forEach(row => {
      console.log(`  ${row.avatar_tier}: ${row.count} players`);
    });
    
    console.log('\n🔄 Reassigning ratings for proper distribution...');
    
    // Strategy: Assign ratings based on sport priority and performance potential
    const updates = [
      // NFL players get priority (top tier professional sport)
      {
        query: `
          UPDATE players 
          SET overall_rating = 90 + (RANDOM() * 8)::integer, avatar_tier = 'star'
          WHERE sport_id = 'NFL' 
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'NFL' 
            ORDER BY RANDOM() LIMIT 200
          )
        `,
        description: '200 NFL star players'
      },
      
      // NBA players get high priority  
      {
        query: `
          UPDATE players 
          SET overall_rating = 90 + (RANDOM() * 8)::integer, avatar_tier = 'star'
          WHERE sport_id = 'nba' 
          AND overall_rating < 90
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'nba' AND overall_rating < 90
            ORDER BY RANDOM() LIMIT 150
          )
        `,
        description: '150 NBA star players'
      },
      
      // MLB players
      {
        query: `
          UPDATE players 
          SET overall_rating = 90 + (RANDOM() * 8)::integer, avatar_tier = 'star'
          WHERE sport_id IN ('MLB', 'mlb')
          AND overall_rating < 90
          AND id IN (
            SELECT id FROM players WHERE sport_id IN ('MLB', 'mlb') AND overall_rating < 90
            ORDER BY RANDOM() LIMIT 100
          )
        `,
        description: '100 MLB star players'
      },
      
      // NHL players
      {
        query: `
          UPDATE players 
          SET overall_rating = 90 + (RANDOM() * 8)::integer, avatar_tier = 'star'
          WHERE sport_id = 'NHL'
          AND overall_rating < 90
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'NHL' AND overall_rating < 90
            ORDER BY RANDOM() LIMIT 50
          )
        `,
        description: '50 NHL star players'
      },
      
      // NFL Starter players
      {
        query: `
          UPDATE players 
          SET overall_rating = 75 + (RANDOM() * 14)::integer, avatar_tier = 'starter'
          WHERE sport_id = 'NFL' 
          AND overall_rating < 75
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'NFL' AND overall_rating < 75
            ORDER BY RANDOM() LIMIT 1500
          )
        `,
        description: '1500 NFL starter players'
      },
      
      // NBA Starter players
      {
        query: `
          UPDATE players 
          SET overall_rating = 75 + (RANDOM() * 14)::integer, avatar_tier = 'starter'
          WHERE sport_id = 'nba'
          AND overall_rating < 75
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'nba' AND overall_rating < 75
            ORDER BY RANDOM() LIMIT 400
          )
        `,
        description: '400 NBA starter players'
      },
      
      // College Football stars (NCAA_FB)
      {
        query: `
          UPDATE players 
          SET overall_rating = 85 + (RANDOM() * 10)::integer, avatar_tier = 'starter'
          WHERE sport_id = 'NCAA_FB'
          AND overall_rating < 75
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'NCAA_FB' AND overall_rating < 75
            ORDER BY RANDOM() LIMIT 2000
          )
        `,
        description: '2000 NCAA Football starter players'
      },
      
      // College Basketball players (NCAA_BB) 
      {
        query: `
          UPDATE players 
          SET overall_rating = 80 + (RANDOM() * 10)::integer, avatar_tier = 'starter'
          WHERE sport_id = 'NCAA_BB'
          AND overall_rating < 75
          AND id IN (
            SELECT id FROM players WHERE sport_id = 'NCAA_BB' AND overall_rating < 75
            ORDER BY RANDOM() LIMIT 1000
          )
        `,
        description: '1000 NCAA Basketball starter players'
      },
      
      // Remaining players get random distribution
      {
        query: `
          UPDATE players 
          SET overall_rating = 60 + (RANDOM() * 14)::integer, avatar_tier = 'bench'
          WHERE overall_rating = 60 AND avatar_tier = 'bench'
        `,
        description: 'Random ratings for remaining bench players'
      }
    ];
    
    // Execute updates
    for (const update of updates) {
      console.log(`🔄 ${update.description}...`);
      const result = await pool.query(update.query);
      console.log(`   ✅ Updated ${result.rowCount} players`);
    }
    
    await pool.query('COMMIT');
    
    // Show final distribution
    console.log('\n📊 FINAL DISTRIBUTION:');
    const finalResult = await pool.query(`
      SELECT 
        avatar_tier,
        COUNT(*) as count,
        MIN(overall_rating) as min_rating,
        MAX(overall_rating) as max_rating,
        ROUND(AVG(overall_rating), 1) as avg_rating
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
    
    finalResult.rows.forEach(row => {
      const emoji = row.avatar_tier === 'star' ? '⭐' : row.avatar_tier === 'starter' ? '🏃' : '🏃‍♂️';
      console.log(`${emoji} ${row.avatar_tier.toUpperCase()}: ${row.count.toLocaleString()} players (${row.min_rating}-${row.max_rating}, avg: ${row.avg_rating})`);
    });
    
    // Show sport breakdown for stars
    console.log('\n⭐ STAR PLAYERS BY SPORT:');
    const starBreakdown = await pool.query(`
      SELECT 
        COALESCE(sport_id, 'Unknown') as sport,
        COUNT(*) as count
      FROM players
      WHERE avatar_tier = 'star'
      GROUP BY sport_id
      ORDER BY COUNT(*) DESC
    `);
    
    starBreakdown.rows.forEach(row => {
      console.log(`   ${row.sport}: ${row.count} players`);
    });
    
    console.log('\n✨ Avatar distribution fixed!');
    console.log('🎯 Now you have a realistic distribution across all sports!');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixDistribution();