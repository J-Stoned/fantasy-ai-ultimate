#!/usr/bin/env npx tsx
import { Client } from 'pg'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ No database URL found in environment variables!')
  process.exit(1)
}

async function main() {
  // Parse the connection string and force IPv4
  const url = new URL(databaseUrl!)
  
  const client = new Client({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected to database')

    // Get initial counts
    console.log('\n📊 Getting initial counts...')
    
    const totalGamesResult = await client.query('SELECT COUNT(*) FROM games')
    const fakeGamesResult = await client.query('SELECT COUNT(*) FROM games WHERE external_id IS NULL')
    const affectedStatsResult = await client.query(`
      SELECT COUNT(*) FROM player_stats ps
      WHERE EXISTS (
        SELECT 1 FROM games g 
        WHERE g.id = ps.game_id 
        AND g.external_id IS NULL
      )
    `)
    const affectedLogsResult = await client.query(`
      SELECT COUNT(*) FROM player_game_logs pgl
      WHERE EXISTS (
        SELECT 1 FROM games g 
        WHERE g.id = pgl.game_id 
        AND g.external_id IS NULL
      )
    `)

    console.log('Initial Database State:')
    console.log(`- Total games: ${totalGamesResult.rows[0].count}`)
    console.log(`- Fake games (NULL external_id): ${fakeGamesResult.rows[0].count}`)
    console.log(`- Affected player_stats: ${affectedStatsResult.rows[0].count}`)
    console.log(`- Affected player_game_logs: ${affectedLogsResult.rows[0].count}`)

    if (fakeGamesResult.rows[0].count === '0') {
      console.log('\n✅ No fake games found to delete!')
      return
    }

    // Begin transaction
    console.log('\n🧹 Starting cleanup transaction...')
    await client.query('BEGIN')

    try {
      // Delete player_stats
      console.log('Deleting player_stats...')
      const statsResult = await client.query(`
        DELETE FROM player_stats ps
        WHERE EXISTS (
          SELECT 1 FROM games g 
          WHERE g.id = ps.game_id 
          AND g.external_id IS NULL
        )
      `)
      console.log(`✅ Deleted ${statsResult.rowCount} player_stats records`)

      // Delete player_game_logs
      console.log('Deleting player_game_logs...')
      const logsResult = await client.query(`
        DELETE FROM player_game_logs pgl
        WHERE EXISTS (
          SELECT 1 FROM games g 
          WHERE g.id = pgl.game_id 
          AND g.external_id IS NULL
        )
      `)
      console.log(`✅ Deleted ${logsResult.rowCount} player_game_logs records`)

      // Delete games
      console.log('Deleting games with NULL external_id...')
      const gamesResult = await client.query(`
        DELETE FROM games 
        WHERE external_id IS NULL
      `)
      console.log(`✅ Deleted ${gamesResult.rowCount} games`)

      // Commit transaction
      await client.query('COMMIT')
      console.log('\n✅ Transaction committed successfully!')

      // Get final counts
      console.log('\n📊 Getting final counts...')
      const finalGamesResult = await client.query('SELECT COUNT(*) FROM games')
      console.log(`Final Database State:`)
      console.log(`- Remaining games: ${finalGamesResult.rows[0].count}`)

      console.log('\n🎉 Cleanup completed successfully!')
      console.log('\n📋 Summary:')
      console.log(`- Deleted player_stats: ${statsResult.rowCount}`)
      console.log(`- Deleted player_game_logs: ${logsResult.rowCount}`)
      console.log(`- Deleted games: ${gamesResult.rowCount}`)

    } catch (error) {
      console.error('❌ Error during cleanup, rolling back transaction:', error)
      await client.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await client.end()
    console.log('\n🔌 Database connection closed')
  }
}

// Run the cleanup
main().catch(console.error)