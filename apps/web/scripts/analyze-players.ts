import { Pool } from 'pg';

const pool = new Pool({
  host: '172.30.176.1',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
});

async function analyzePlayersDetailed() {
  const client = await pool.connect();
  
  try {
    console.log('🏃 DETAILED PLAYER ANALYSIS\n');
    console.log('=' .repeat(80));

    // 1. Players table structure
    console.log('\n📋 PLAYERS TABLE STRUCTURE:');
    console.log('-'.repeat(80));
    
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'players'
      ORDER BY ordinal_position;
    `;
    
    const columns = await client.query(columnsQuery);
    console.log('Column Name\t\t\tData Type\t\tNullable\tDefault');
    console.log('-'.repeat(80));
    
    columns.rows.forEach(col => {
      const colName = col.column_name.padEnd(25);
      const dataType = col.data_type.padEnd(20);
      const nullable = col.is_nullable.padEnd(10);
      const defaultVal = col.column_default || 'none';
      console.log(`${colName}\t${dataType}\t${nullable}\t${defaultVal}`);
    });

    // 2. Check if sport column exists
    const sportColumnExists = columns.rows.some(col => col.column_name === 'sport');
    
    if (sportColumnExists) {
      console.log('\n📊 PLAYERS BY SPORT:');
      console.log('-'.repeat(80));
      
      const sportQuery = `
        SELECT 
          sport,
          COUNT(*) as player_count,
          COUNT(DISTINCT team_id) as team_count
        FROM players
        WHERE sport IS NOT NULL
        GROUP BY sport
        ORDER BY player_count DESC;
      `;
      
      const sportCounts = await client.query(sportQuery);
      console.log('Sport\t\tPlayers\t\tTeams');
      console.log('-'.repeat(80));
      
      let totalPlayers = 0;
      sportCounts.rows.forEach(row => {
        totalPlayers += parseInt(row.player_count);
        const sport = (row.sport || 'Unknown').padEnd(15);
        console.log(`${sport}\t${row.player_count}\t\t${row.team_count}`);
      });
      console.log('-'.repeat(80));
      console.log(`TOTAL:\t\t${totalPlayers}`);
    }

    // 3. Players by status
    console.log('\n📊 PLAYERS BY STATUS:');
    console.log('-'.repeat(80));
    
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM players
      GROUP BY status
      ORDER BY count DESC;
    `;
    
    const statusCounts = await client.query(statusQuery);
    statusCounts.rows.forEach(row => {
      const status = (row.status || 'Unknown').padEnd(20);
      console.log(`${status}: ${row.count}`);
    });

    // 4. Players by position (sample)
    console.log('\n📊 TOP POSITIONS BY PLAYER COUNT:');
    console.log('-'.repeat(80));
    
    const positionQuery = `
      SELECT 
        position,
        COUNT(*) as count
      FROM players
      WHERE position IS NOT NULL
      GROUP BY position
      ORDER BY count DESC
      LIMIT 20;
    `;
    
    const positionCounts = await client.query(positionQuery);
    positionCounts.rows.forEach(row => {
      const position = row.position.padEnd(15);
      console.log(`${position}: ${row.count}`);
    });

    // 5. Check players_master table
    console.log('\n📋 PLAYERS_MASTER TABLE:');
    console.log('-'.repeat(80));
    
    const masterSportQuery = `
      SELECT 
        sport,
        COUNT(*) as player_count,
        COUNT(DISTINCT our_player_id) as unique_players
      FROM players_master
      WHERE sport IS NOT NULL
      GROUP BY sport
      ORDER BY player_count DESC;
    `;
    
    const masterSports = await client.query(masterSportQuery);
    console.log('Sport\t\tRecords\t\tUnique Players');
    console.log('-'.repeat(80));
    
    masterSports.rows.forEach(row => {
      const sport = (row.sport || 'Unknown').padEnd(15);
      console.log(`${sport}\t${row.player_count}\t\t${row.unique_players}`);
    });

    // 6. Recent player game stats
    console.log('\n📊 RECENT PLAYER GAME STATS:');
    console.log('-'.repeat(80));
    
    const recentStatsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT player_id) as unique_players,
        COUNT(DISTINCT game_id) as unique_games,
        MIN(created_at) as earliest_record,
        MAX(created_at) as latest_record
      FROM player_game_stats;
    `;
    
    const recentStats = await client.query(recentStatsQuery);
    const stats = recentStats.rows[0];
    console.log(`Total Game Stat Records: ${parseInt(stats.total_records).toLocaleString()}`);
    console.log(`Unique Players with Stats: ${parseInt(stats.unique_players).toLocaleString()}`);
    console.log(`Unique Games: ${parseInt(stats.unique_games).toLocaleString()}`);
    console.log(`Date Range: ${stats.earliest_record} to ${stats.latest_record}`);

    // 7. Sample player data
    console.log('\n📋 SAMPLE PLAYER DATA (5 records):');
    console.log('-'.repeat(80));
    
    const sampleQuery = `
      SELECT 
        id,
        firstname,
        lastname,
        position,
        team_id,
        status
      FROM players
      WHERE firstname IS NOT NULL AND lastname IS NOT NULL
      LIMIT 5;
    `;
    
    const samples = await client.query(sampleQuery);
    samples.rows.forEach(player => {
      console.log(`ID: ${player.id}, Name: ${player.firstname} ${player.lastname}, Pos: ${player.position}, Team: ${player.team_id}, Status: ${player.status}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Player analysis complete!');
    
  } catch (error) {
    console.error('Error analyzing players:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzePlayersDetailed().catch(console.error);