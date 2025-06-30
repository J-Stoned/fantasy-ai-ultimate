const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function seedDatabase() {
  console.log('🌱 Seeding database with initial data...\n');

  try {
    // Sports
    console.log('📊 Inserting sports...');
    const { data: sports, error: sportsError } = await supabase
      .from('sports')
      .upsert([
        { name: 'Football', sport_type: 'football', description: 'American Football' },
        { name: 'Basketball', sport_type: 'basketball', description: 'Basketball' },
        { name: 'Baseball', sport_type: 'baseball', description: 'Baseball' },
        { name: 'Hockey', sport_type: 'hockey', description: 'Ice Hockey' },
        { name: 'Soccer', sport_type: 'soccer', description: 'Association Football' }
      ])
      .select();

    if (sportsError) throw sportsError;
    console.log(`✅ Created ${sports.length} sports\n`);

    // Get sport IDs for leagues
    const footballId = sports.find(s => s.sport_type === 'football').id;
    const basketballId = sports.find(s => s.sport_type === 'basketball').id;
    const baseballId = sports.find(s => s.sport_type === 'baseball').id;
    const hockeyId = sports.find(s => s.sport_type === 'hockey').id;
    const soccerId = sports.find(s => s.sport_type === 'soccer').id;

    // Leagues
    console.log('🏆 Inserting leagues...');
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .upsert([
        { sport_id: footballId, name: 'National Football League', abbreviation: 'NFL', level: 'professional', country: 'USA' },
        { sport_id: footballId, name: 'NCAA Division I Football', abbreviation: 'NCAA FB', level: 'college', country: 'USA' },
        { sport_id: basketballId, name: 'National Basketball Association', abbreviation: 'NBA', level: 'professional', country: 'USA' },
        { sport_id: basketballId, name: 'NCAA Division I Basketball', abbreviation: 'NCAA BB', level: 'college', country: 'USA' },
        { sport_id: baseballId, name: 'Major League Baseball', abbreviation: 'MLB', level: 'professional', country: 'USA' },
        { sport_id: hockeyId, name: 'National Hockey League', abbreviation: 'NHL', level: 'professional', country: 'USA/Canada' },
        { sport_id: soccerId, name: 'Premier League', abbreviation: 'EPL', level: 'professional', country: 'England' },
        { sport_id: soccerId, name: 'Major League Soccer', abbreviation: 'MLS', level: 'professional', country: 'USA/Canada' }
      ])
      .select();

    if (leaguesError) throw leaguesError;
    console.log(`✅ Created ${leagues.length} leagues\n`);

    // Get league IDs for teams
    const nflId = leagues.find(l => l.abbreviation === 'NFL').id;
    const nbaId = leagues.find(l => l.abbreviation === 'NBA').id;

    // Sample teams
    console.log('🏈 Inserting sample teams...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams_master')
      .upsert([
        { league_id: nflId, name: 'Patriots', city: 'New England', abbreviation: 'NE' },
        { league_id: nflId, name: 'Cowboys', city: 'Dallas', abbreviation: 'DAL' },
        { league_id: nflId, name: 'Chiefs', city: 'Kansas City', abbreviation: 'KC' },
        { league_id: nflId, name: '49ers', city: 'San Francisco', abbreviation: 'SF' },
        { league_id: nbaId, name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL' },
        { league_id: nbaId, name: 'Celtics', city: 'Boston', abbreviation: 'BOS' },
        { league_id: nbaId, name: 'Warriors', city: 'Golden State', abbreviation: 'GSW' },
        { league_id: nbaId, name: 'Heat', city: 'Miami', abbreviation: 'MIA' }
      ])
      .select();

    if (teamsError) throw teamsError;
    console.log(`✅ Created ${teams.length} teams\n`);

    console.log('🎉 Database seeded successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${sports.length} sports`);
    console.log(`   - ${leagues.length} leagues`);
    console.log(`   - ${teams.length} teams`);
    console.log('\n🚀 Ready to start development!');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('Details:', error);
  }
}

seedDatabase();