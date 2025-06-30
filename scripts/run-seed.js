const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSeed() {
  console.log('🌱 Running seed data...');
  
  try {
    // Read seed file
    const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    
    // Split by semicolon to run statements individually
    const statements = seedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      // Parse INSERT statements to use Supabase client
      if (statement.includes('INSERT INTO sports')) {
        const sports = [
          { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Football', sport_type: 'football', description: 'American Football' },
          { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Basketball', sport_type: 'basketball', description: 'Basketball' },
          { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Baseball', sport_type: 'baseball', description: 'Baseball' },
          { id: '550e8400-e29b-41d4-a716-446655440004', name: 'Hockey', sport_type: 'hockey', description: 'Ice Hockey' },
          { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Soccer', sport_type: 'soccer', description: 'Association Football' }
        ];
        
        const { error } = await supabase.from('sports').upsert(sports, { onConflict: 'id' });
        if (error) {
          console.log('Sports insert error:', error);
          throw error;
        } else {
          console.log('✅ Inserted sports');
        }
      }
      
      else if (statement.includes('INSERT INTO leagues')) {
        const leagues = [
          { id: '660e8400-e29b-41d4-a716-446655440001', sport_id: '550e8400-e29b-41d4-a716-446655440001', name: 'National Football League', abbreviation: 'NFL', level: 'professional', country: 'USA' },
          { id: '660e8400-e29b-41d4-a716-446655440002', sport_id: '550e8400-e29b-41d4-a716-446655440001', name: 'NCAA Division I Football', abbreviation: 'NCAA D1', level: 'college', country: 'USA' },
          { id: '660e8400-e29b-41d4-a716-446655440003', sport_id: '550e8400-e29b-41d4-a716-446655440002', name: 'National Basketball Association', abbreviation: 'NBA', level: 'professional', country: 'USA' },
          { id: '660e8400-e29b-41d4-a716-446655440004', sport_id: '550e8400-e29b-41d4-a716-446655440002', name: 'NCAA Division I Basketball', abbreviation: 'NCAA D1', level: 'college', country: 'USA' },
          { id: '660e8400-e29b-41d4-a716-446655440005', sport_id: '550e8400-e29b-41d4-a716-446655440003', name: 'Major League Baseball', abbreviation: 'MLB', level: 'professional', country: 'USA' },
          { id: '660e8400-e29b-41d4-a716-446655440006', sport_id: '550e8400-e29b-41d4-a716-446655440004', name: 'National Hockey League', abbreviation: 'NHL', level: 'professional', country: 'USA/Canada' },
          { id: '660e8400-e29b-41d4-a716-446655440007', sport_id: '550e8400-e29b-41d4-a716-446655440005', name: 'Premier League', abbreviation: 'EPL', level: 'professional', country: 'England' },
          { id: '660e8400-e29b-41d4-a716-446655440008', sport_id: '550e8400-e29b-41d4-a716-446655440005', name: 'Major League Soccer', abbreviation: 'MLS', level: 'professional', country: 'USA/Canada' }
        ];
        
        const { error } = await supabase.from('leagues').insert(leagues);
        if (error) console.log('Leagues insert error:', error.message);
        else console.log('✅ Inserted leagues');
      }
      
      else if (statement.includes('INSERT INTO teams_master')) {
        const teams = [
          { id: '770e8400-e29b-41d4-a716-446655440001', league_id: '660e8400-e29b-41d4-a716-446655440001', name: 'Patriots', city: 'New England', abbreviation: 'NE' },
          { id: '770e8400-e29b-41d4-a716-446655440002', league_id: '660e8400-e29b-41d4-a716-446655440001', name: 'Cowboys', city: 'Dallas', abbreviation: 'DAL' },
          { id: '770e8400-e29b-41d4-a716-446655440003', league_id: '660e8400-e29b-41d4-a716-446655440003', name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL' },
          { id: '770e8400-e29b-41d4-a716-446655440004', league_id: '660e8400-e29b-41d4-a716-446655440003', name: 'Celtics', city: 'Boston', abbreviation: 'BOS' }
        ];
        
        const { error } = await supabase.from('teams_master').insert(teams);
        if (error) console.log('Teams insert error:', error.message);
        else console.log('✅ Inserted teams');
      }
    }
    
    console.log('\n🎉 Seed data loaded successfully!');
    
    // Verify
    const { data: sports } = await supabase.from('sports').select('*');
    const { data: leagues } = await supabase.from('leagues').select('*');
    const { data: teams } = await supabase.from('teams_master').select('*');
    
    console.log(`\n📊 Database now contains:`);
    console.log(`- ${sports?.length || 0} sports`);
    console.log(`- ${leagues?.length || 0} leagues`);
    console.log(`- ${teams?.length || 0} teams`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
  }
}

runSeed();