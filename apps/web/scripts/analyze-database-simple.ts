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

    // 1. List all tables
    console.log('\n📊 ALL TABLES:');
    console.log('-'.repeat(80));
    
    const tablesQuery = `
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `;
    
    const tables = await client.query(tablesQuery);
    console.log('Schema\t\tTable Name\t\t\t\tType');
    console.log('-'.repeat(80));
    
    const tableList = [];
    tables.rows.forEach(row => {
      const tableName = row.table_name.padEnd(35);
      console.log(`${row.table_schema}\t\t${tableName}\t${row.table_type}`);
      if (row.table_type === 'BASE TABLE') {
        tableList.push(`${row.table_schema}.${row.table_name}`);
      }
    });

    // 2. Get row counts for each table
    console.log('\n📈 ROW COUNTS:');
    console.log('-'.repeat(80));
    
    let totalRows = 0;
    for (const table of tableList) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${table}`;
        const result = await client.query(countQuery);
        const count = parseInt(result.rows[0].count);
        totalRows += count;
        if (count > 0) {
          console.log(`${table.padEnd(50)}: ${count.toLocaleString()} rows`);
        }
      } catch (e) {
        console.log(`${table.padEnd(50)}: Error counting rows`);
      }
    }
    console.log('-'.repeat(80));
    console.log(`TOTAL ROWS ACROSS ALL TABLES: ${totalRows.toLocaleString()}`);

    // 3. Database size
    console.log('\n💾 DATABASE SIZE:');
    console.log('-'.repeat(80));
    
    const sizeQuery = `
      SELECT 
        pg_size_pretty(pg_database_size('fantasy_ai_local')) AS database_size;
    `;
    
    const dbSize = await client.query(sizeQuery);
    console.log(`Total Database Size: ${dbSize.rows[0].database_size}`);

    // 4. List all schemas
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

    // 5. Table sizes
    console.log('\n📊 TABLE SIZES (Top 10):');
    console.log('-'.repeat(80));
    
    const sizeList = [];
    for (const table of tableList) {
      try {
        const sizeQuery = `
          SELECT 
            pg_size_pretty(pg_total_relation_size('${table}')) as total_size,
            pg_total_relation_size('${table}') as size_bytes
        `;
        const result = await client.query(sizeQuery);
        sizeList.push({
          table: table,
          size: result.rows[0].total_size,
          bytes: parseInt(result.rows[0].size_bytes)
        });
      } catch (e) {
        // Skip
      }
    }
    
    // Sort by size and show top 10
    sizeList.sort((a, b) => b.bytes - a.bytes);
    sizeList.slice(0, 10).forEach(item => {
      console.log(`${item.table.padEnd(50)}: ${item.size}`);
    });

    // 6. Extensions
    console.log('\n🔧 EXTENSIONS:');
    console.log('-'.repeat(80));
    
    const extensionsQuery = `
      SELECT extname, extversion 
      FROM pg_extension 
      ORDER BY extname;
    `;
    
    const extensions = await client.query(extensionsQuery);
    extensions.rows.forEach(row => {
      console.log(`- ${row.extname} (v${row.extversion})`);
    });

    // 7. Player information
    console.log('\n🏃 PLAYER INFORMATION:');
    console.log('-'.repeat(80));
    
    // Check for player-related tables
    const playerTables = tableList.filter(t => 
      t.toLowerCase().includes('player') || 
      t.toLowerCase().includes('athlete')
    );
    
    console.log(`Found ${playerTables.length} player-related tables:`);
    
    for (const table of playerTables) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${table}`;
        const result = await client.query(countQuery);
        console.log(`- ${table}: ${parseInt(result.rows[0].count).toLocaleString()} records`);
        
        // Try to get column information
        const columnsQuery = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema || '.' || table_name = '${table}'
          ORDER BY ordinal_position
          LIMIT 10;
        `;
        const columns = await client.query(columnsQuery);
        if (columns.rows.length > 0) {
          console.log(`  Columns: ${columns.rows.map(c => c.column_name).join(', ')}`);
        }
      } catch (e) {
        console.log(`- ${table}: Error reading`);
      }
    }

    // 8. Additional statistics
    console.log('\n📊 DATABASE STATISTICS:');
    console.log('-'.repeat(80));
    
    // Index count
    const indexQuery = `
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
    `;
    const indexCount = await client.query(indexQuery);
    console.log(`Total Indexes: ${indexCount.rows[0].count}`);
    
    // View count
    const viewQuery = `
      SELECT COUNT(*) as count 
      FROM information_schema.views 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    `;
    const viewCount = await client.query(viewQuery);
    console.log(`Total Views: ${viewCount.rows[0].count}`);
    
    // Column count
    const columnQuery = `
      SELECT COUNT(*) as count 
      FROM information_schema.columns 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    `;
    const columnCount = await client.query(columnQuery);
    console.log(`Total Columns: ${columnCount.rows[0].count}`);
    
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