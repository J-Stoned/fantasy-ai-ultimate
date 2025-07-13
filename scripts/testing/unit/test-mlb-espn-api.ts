import axios from 'axios';

async function testMLBESPNAPI() {
  console.log('🔍 Testing MLB ESPN API...\n');
  
  // Test with actual ESPN IDs from our database
  const testIds = ['401764567', '401696326', '401696323'];
  
  for (const id of testIds) {
    console.log(`Testing ESPN ID: ${id}`);
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${id}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`✅ Success! Status: ${response.status}`);
      console.log(`   Game: ${response.data.header?.competitions?.[0]?.competitors?.map((t: any) => t.team.displayName).join(' vs ')}`);
      console.log(`   Has boxscore: ${!!response.data.boxscore}`);
      
      if (response.data.boxscore?.players) {
        const team = response.data.boxscore.players[0];
        console.log(`   Categories: ${team.statistics?.map((s: any) => s.name).join(', ')}`);
        
        // Check batting structure
        const batting = team.statistics?.find((s: any) => s.name === 'batting');
        if (batting?.athletes?.[0]) {
          console.log(`   Sample player: ${batting.athletes[0].athlete.displayName}`);
          console.log(`   Stats length: ${batting.athletes[0].stats?.length}`);
        }
      }
      
    } catch (error: any) {
      console.log(`❌ Failed: ${error.response?.status || error.message}`);
    }
    
    console.log('');
  }
}

testMLBESPNAPI().catch(console.error);