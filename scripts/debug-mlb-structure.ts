import axios from 'axios';

async function debugMLBStructure() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=401764567';
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    console.log('🔍 MLB API Structure:\n');
    
    // Check boxscore structure
    if (response.data.boxscore) {
      console.log('Boxscore keys:', Object.keys(response.data.boxscore));
      
      if (response.data.boxscore.players) {
        console.log('\nPlayers array length:', response.data.boxscore.players.length);
        
        const team = response.data.boxscore.players[0];
        console.log('\nTeam structure:');
        console.log('  Keys:', Object.keys(team));
        console.log('  Team name:', team.team?.displayName);
        
        if (team.statistics) {
          console.log('\n  Statistics array:');
          team.statistics.forEach((stat: any, i: number) => {
            console.log(`    [${i}]:`, {
              keys: Object.keys(stat),
              name: stat.name,
              type: stat.type,
              athletesCount: stat.athletes?.length || 0
            });
          });
          
          // Find batting/pitching
          const batting = team.statistics.find((s: any) => 
            s.name === 'batting' || s.type === 'batting' || s.labels?.[0] === 'AB'
          );
          
          if (batting) {
            console.log('\n  Found batting stats!');
            console.log('    Labels:', batting.labels);
            console.log('    Athletes:', batting.athletes?.length);
            
            if (batting.athletes?.[0]) {
              const player = batting.athletes[0];
              console.log('\n    Sample player:', player.athlete?.displayName);
              console.log('    Stats:', player.stats);
            }
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

debugMLBStructure();