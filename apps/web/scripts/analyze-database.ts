import { Pool } from 'pg';

const pool = new Pool({
  host: '172.30.176.1',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
});

async function analyzeDatabaseStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 DATABASE ANALYSIS: fantasy_ai_local\n');
    console.log('=' .repeat(80));

    // 1. List all tables with row counts
    console.log('\n📊 TABLES WITH ROW COUNTS:');
    console.log('-'.repeat(80));
    
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;
    `;
    
    const tables = await client.query(tablesQuery);
    console.log('Schema\t\tTable Name\t\t\t\tRows\t\tSize');
    console.log('-'.repeat(80));
    
    let totalRows = 0;
    tables.rows.forEach(row => {
      totalRows += parseInt(row.row_count) || 0;
      const tableName = row.tablename.padEnd(30);
      const rowCount = row.row_count.toString().padEnd(10);
      console.log(`${row.schemaname}\t\t${tableName}\t${rowCount}\t${row.total_size}`);
    });
    console.log('-'.repeat(80));
    console.log(`TOTAL ROWS ACROSS ALL TABLES: ${totalRows.toLocaleString()}`);

    // 2. Database size
    console.log('\n💾 DATABASE SIZE:');
    console.log('-'.repeat(80));
    
    const sizeQuery = `
      SELECT 
        pg_database.datname,
        pg_size_pretty(pg_database_size(pg_database.datname)) AS size
      FROM pg_database
      WHERE datname = 'fantasy_ai_local';
    `;
    
    const dbSize = await client.query(sizeQuery);
    dbSize.rows.forEach(row => {
      console.log(`Database: ${row.datname}`);
      console.log(`Total Size: ${row.size}`);
    });

    // 3. List all schemas
    console.log('\n📁 SCHEMAS:');
    console.log('-'.repeat(80));
    
    const schemasQuery = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name;
    `;
    
    const schemas = await client.query(schemasQuery);
    schemas.rows.forEach(row => {
      console.log(`- ${row.schema_name}`);
    });

    // 4. Largest tables
    console.log('\n📈 TOP 10 LARGEST TABLES:');
    console.log('-'.repeat(80));
    
    const largestTablesQuery = `
      SELECT 
        schemaname || '.' || tablename AS table_full_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10;
    `;
    
    const largestTables = await client.query(largestTablesQuery);
    console.log('Table\t\t\t\t\tTotal Size\tTable Size\tIndex Size\tRows');
    console.log('-'.repeat(80));
    
    largestTables.rows.forEach(row => {
      const tableName = row.table_full_name.padEnd(35);
      console.log(`${tableName}\t${row.total_size}\t\t${row.table_size}\t\t${row.indexes_size}\t\t${row.row_count}`);
    });

    // 5. Custom types and extensions
    console.log('\n🔧 EXTENSIONS:');
    console.log('-'.repeat(80));
    
    const extensionsQuery = `
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname != 'plpgsql'
      ORDER BY extname;
    `;
    
    const extensions = await client.query(extensionsQuery);
    if (extensions.rows.length === 0) {
      console.log('No additional extensions installed');
    } else {
      extensions.rows.forEach(row => {
        console.log(`- ${row.extname} (v${row.extversion})`);
      });
    }

    console.log('\n🎨 CUSTOM TYPES:');
    console.log('-'.repeat(80));
    
    const typesQuery = `
      SELECT 
        n.nspname as schema,
        t.typname as typename,
        t.typtype
      FROM pg_type t
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid))
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid)
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, t.typname;
    `;
    
    const types = await client.query(typesQuery);
    if (types.rows.length === 0) {
      console.log('No custom types found');
    } else {
      types.rows.forEach(row => {
        console.log(`- ${row.schema}.${row.typename} (type: ${row.typtype})`);
      });
    }

    // 6. Total number of players
    console.log('\n🏃 PLAYER COUNTS:');
    console.log('-'.repeat(80));
    
    try {
      const playerCounts = [];
      
      // Check different player tables
      const playerTables = ['players', 'player', 'athletes', 'athlete'];
      
      for (const tableName of playerTables) {
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${tableName};`;
          const result = await client.query(countQuery);
          playerCounts.push({ table: tableName, count: result.rows[0].count });
        } catch (e) {
          // Table doesn't exist, skip
        }
      }
      
      if (playerCounts.length > 0) {
        playerCounts.forEach(pc => {
          console.log(`${pc.table}: ${parseInt(pc.count).toLocaleString()} players`);
        });
      } else {
        console.log('No player tables found');
      }
      
      // Try to get sport-specific counts
      const sportCountQuery = `
        SELECT sport, COUNT(*) as count 
        FROM players 
        GROUP BY sport 
        ORDER BY count DESC;
      `;
      
      try {
        const sportCounts = await client.query(sportCountQuery);
        if (sportCounts.rows.length > 0) {
          console.log('\nPlayers by Sport:');
          sportCounts.rows.forEach(row => {
            console.log(`- ${row.sport}: ${parseInt(row.count).toLocaleString()}`);
          });
        }
      } catch (e) {
        // Sport column might not exist
      }
      
    } catch (e) {
      console.log('Could not determine player count');
    }

    // Additional useful information
    console.log('\n📋 ADDITIONAL INFO:');
    console.log('-'.repeat(80));
    
    // Check for indexes
    const indexCountQuery = `
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
    `;
    
    const indexCount = await client.query(indexCountQuery);
    console.log(`Total Indexes: ${indexCount.rows[0].count}`);
    
    // Check for views
    const viewCountQuery = `
      SELECT COUNT(*) as count 
      FROM information_schema.views 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    `;
    
    const viewCount = await client.query(viewCountQuery);
    console.log(`Total Views: ${viewCount.rows[0].count}`);
    
    // Check for functions
    const functionCountQuery = `
      SELECT COUNT(*) as count 
      FROM information_schema.routines 
      WHERE routine_schema NOT IN ('pg_catalog', 'information_schema');
    `;
    
    const functionCount = await client.query(functionCountQuery);
    console.log(`Total Functions: ${functionCount.rows[0].count}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Database analysis complete!');
    
  } catch (error) {
    console.error('Error analyzing database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeDatabaseStructure().catch(console.error);