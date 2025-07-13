const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Database connected successfully!');
    
    // Count tables
    const tables = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log(`📊 Total tables created: ${tables[0].count}`);
    
    // Check key tables
    const keyTables = ['players', 'teams_master', 'leagues', 'sports', 'fantasy_leagues'];
    for (const table of keyTables) {
      const exists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        ) as exists
      `;
      console.log(`${exists[0].exists ? '✅' : '❌'} Table ${table}`);
    }
    
    // Check if any data exists
    const sports = await prisma.sports.count();
    console.log(`\n🏈 Sports in database: ${sports}`);
    
    if (sports === 0) {
      console.log('💡 No data yet. Run the seed.sql file to add initial data!');
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();