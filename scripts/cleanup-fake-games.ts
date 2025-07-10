#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function getInitialCounts() {
  console.log('🔍 Getting initial counts...')
  
  // Count games with NULL external_id
  const { count: fakeGamesCount, error: gamesError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  if (gamesError) {
    console.error('Error counting fake games:', gamesError)
    return null
  }
  
  // Count total games
  const { count: totalGamesCount, error: totalError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  if (totalError) {
    console.error('Error counting total games:', totalError)
    return null
  }
  
  // Count affected player_stats
  const { data: affectedStatsData, error: statsError } = await supabase
    .rpc('count_affected_player_stats')
  
  // Count affected player_game_logs
  const { data: affectedLogsData, error: logsError } = await supabase
    .rpc('count_affected_player_game_logs')
  
  return {
    fakeGames: fakeGamesCount || 0,
    totalGames: totalGamesCount || 0,
    affectedStats: affectedStatsData || 0,
    affectedLogs: affectedLogsData || 0
  }
}

async function createCountingFunctions() {
  console.log('📊 Creating counting functions...')
  
  // Create function to count affected player_stats
  const createStatsCountFunc = `
    CREATE OR REPLACE FUNCTION count_affected_player_stats()
    RETURNS BIGINT AS $$
    BEGIN
      RETURN (
        SELECT COUNT(*)
        FROM player_stats ps
        WHERE EXISTS (
          SELECT 1 FROM games g 
          WHERE g.id = ps.game_id 
          AND g.external_id IS NULL
        )
      );
    END;
    $$ LANGUAGE plpgsql;
  `
  
  // Create function to count affected player_game_logs
  const createLogsCountFunc = `
    CREATE OR REPLACE FUNCTION count_affected_player_game_logs()
    RETURNS BIGINT AS $$
    BEGIN
      RETURN (
        SELECT COUNT(*)
        FROM player_game_logs pgl
        WHERE EXISTS (
          SELECT 1 FROM games g 
          WHERE g.id = pgl.game_id 
          AND g.external_id IS NULL
        )
      );
    END;
    $$ LANGUAGE plpgsql;
  `
  
  const { error: statsCountError } = await supabase.rpc('query', { 
    query: createStatsCountFunc 
  })
  
  const { error: logsCountError } = await supabase.rpc('query', { 
    query: createLogsCountFunc 
  })
  
  if (statsCountError || logsCountError) {
    console.error('Error creating counting functions:', { statsCountError, logsCountError })
  }
}

async function executeCleanup() {
  console.log('🧹 Starting cleanup of fake games...')
  
  try {
    // First, let's try creating a server-side function for efficiency
    console.log('Creating cleanup function...')
    
    const createCleanupFunction = `
      CREATE OR REPLACE FUNCTION cleanup_fake_games()
      RETURNS TABLE(
        deleted_stats BIGINT,
        deleted_logs BIGINT,
        deleted_games BIGINT
      ) AS $$
      DECLARE
        stats_count BIGINT;
        logs_count BIGINT;
        games_count BIGINT;
      BEGIN
        -- Delete from player_stats
        WITH deleted_stats AS (
          DELETE FROM player_stats ps
          WHERE EXISTS (
            SELECT 1 FROM games g 
            WHERE g.id = ps.game_id 
            AND g.external_id IS NULL
          )
          RETURNING 1
        )
        SELECT COUNT(*) INTO stats_count FROM deleted_stats;
        
        -- Delete from player_game_logs
        WITH deleted_logs AS (
          DELETE FROM player_game_logs pgl
          WHERE EXISTS (
            SELECT 1 FROM games g 
            WHERE g.id = pgl.game_id 
            AND g.external_id IS NULL
          )
          RETURNING 1
        )
        SELECT COUNT(*) INTO logs_count FROM deleted_logs;
        
        -- Delete from games
        WITH deleted_games AS (
          DELETE FROM games 
          WHERE external_id IS NULL
          RETURNING 1
        )
        SELECT COUNT(*) INTO games_count FROM deleted_games;
        
        RETURN QUERY SELECT stats_count, logs_count, games_count;
      END;
      $$ LANGUAGE plpgsql;
    `
    
    // Execute the function creation via RPC
    const { error: createError } = await supabase.rpc('query', { 
      query: createCleanupFunction 
    })
    
    if (createError) {
      console.error('Error creating cleanup function:', createError)
      console.log('Falling back to direct deletion...')
      return await directCleanup()
    }
    
    // Execute the cleanup function
    console.log('Executing cleanup function...')
    const { data, error } = await supabase.rpc('cleanup_fake_games')
    
    if (error) {
      console.error('Error executing cleanup function:', error)
      console.log('Falling back to direct deletion...')
      return await directCleanup()
    }
    
    return data ? data[0] : null
    
  } catch (error) {
    console.error('Unexpected error during cleanup:', error)
    console.log('Falling back to direct deletion...')
    return await directCleanup()
  }
}

async function directCleanup() {
  console.log('Executing direct cleanup (this may take longer)...')
  
  const results = {
    deleted_stats: 0,
    deleted_logs: 0,
    deleted_games: 0
  }
  
  try {
    // Delete player_stats in batches
    console.log('Deleting player_stats...')
    let deletedStats = 0
    let hasMore = true
    
    while (hasMore) {
      const { data: statsToDelete } = await supabase
        .from('player_stats')
        .select('id')
        .in('game_id', 
          supabase
            .from('games')
            .select('id')
            .is('external_id', null)
        )
        .limit(1000)
      
      if (!statsToDelete || statsToDelete.length === 0) {
        hasMore = false
        break
      }
      
      const ids = statsToDelete.map(s => s.id)
      const { error } = await supabase
        .from('player_stats')
        .delete()
        .in('id', ids)
      
      if (error) {
        console.error('Error deleting player_stats batch:', error)
      } else {
        deletedStats += ids.length
        console.log(`Deleted ${deletedStats} player_stats records so far...`)
      }
    }
    
    results.deleted_stats = deletedStats
    
    // Delete player_game_logs in batches
    console.log('Deleting player_game_logs...')
    let deletedLogs = 0
    hasMore = true
    
    while (hasMore) {
      const { data: logsToDelete } = await supabase
        .from('player_game_logs')
        .select('id')
        .in('game_id', 
          supabase
            .from('games')
            .select('id')
            .is('external_id', null)
        )
        .limit(1000)
      
      if (!logsToDelete || logsToDelete.length === 0) {
        hasMore = false
        break
      }
      
      const ids = logsToDelete.map(l => l.id)
      const { error } = await supabase
        .from('player_game_logs')
        .delete()
        .in('id', ids)
      
      if (error) {
        console.error('Error deleting player_game_logs batch:', error)
      } else {
        deletedLogs += ids.length
        console.log(`Deleted ${deletedLogs} player_game_logs records so far...`)
      }
    }
    
    results.deleted_logs = deletedLogs
    
    // Delete games
    console.log('Deleting games with NULL external_id...')
    const { count, error: deleteGamesError } = await supabase
      .from('games')
      .delete()
      .is('external_id', null)
      .select('*', { count: 'exact', head: true })
    
    if (deleteGamesError) {
      console.error('Error deleting games:', deleteGamesError)
    } else {
      results.deleted_games = count || 0
    }
    
  } catch (error) {
    console.error('Error during direct cleanup:', error)
  }
  
  return results
}

async function getFinalCounts() {
  console.log('📊 Getting final counts...')
  
  const { count: remainingGames, error } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  if (error) {
    console.error('Error counting remaining games:', error)
    return null
  }
  
  return { remainingGames: remainingGames || 0 }
}

async function main() {
  console.log('🚀 Starting fake games cleanup process...')
  console.log('Database URL:', supabaseUrl)
  
  // Create counting functions first
  await createCountingFunctions()
  
  // Get initial counts
  const initialCounts = await getInitialCounts()
  if (initialCounts) {
    console.log('\n📊 Initial Database State:')
    console.log(`- Total games: ${initialCounts.totalGames}`)
    console.log(`- Fake games (NULL external_id): ${initialCounts.fakeGames}`)
    console.log(`- Affected player_stats: ${initialCounts.affectedStats}`)
    console.log(`- Affected player_game_logs: ${initialCounts.affectedLogs}`)
  }
  
  if (!initialCounts || initialCounts.fakeGames === 0) {
    console.log('\n✅ No fake games found to delete!')
    return
  }
  
  // Execute cleanup
  const results = await executeCleanup()
  
  if (results) {
    console.log('\n✅ Cleanup Results:')
    console.log(`- Deleted player_stats: ${results.deleted_stats}`)
    console.log(`- Deleted player_game_logs: ${results.deleted_logs}`)
    console.log(`- Deleted games: ${results.deleted_games}`)
  }
  
  // Get final counts
  const finalCounts = await getFinalCounts()
  if (finalCounts) {
    console.log('\n📊 Final Database State:')
    console.log(`- Remaining games: ${finalCounts.remainingGames}`)
  }
  
  console.log('\n🎉 Cleanup process completed!')
  
  // Clean up the temporary functions
  console.log('\n🧹 Cleaning up temporary functions...')
  await supabase.rpc('query', { 
    query: 'DROP FUNCTION IF EXISTS cleanup_fake_games();' 
  })
  await supabase.rpc('query', { 
    query: 'DROP FUNCTION IF EXISTS count_affected_player_stats();' 
  })
  await supabase.rpc('query', { 
    query: 'DROP FUNCTION IF EXISTS count_affected_player_game_logs();' 
  })
}

// Run the cleanup
main().catch(console.error)