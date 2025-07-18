import axios from 'axios';
import chalk from 'chalk';

async function diagnoseMiLBAPI() {
  console.log(chalk.cyan('🔍 MiLB API Diagnostic Tool\n'));
  
  // Test cases
  const testGames = [
    { id: 659079, level: 'Triple-A', desc: '2021 Triple-A game' },
    { id: 723781, level: 'Double-A', desc: '2024 Double-A game' },
    { id: 745123, level: 'Triple-A', desc: '2025 Triple-A game' }
  ];
  
  for (const game of testGames) {
    console.log(chalk.yellow(`\n━━━ Testing ${game.desc} (ID: ${game.id}) ━━━`));
    
    try {
      // 1. Test game endpoint
      console.log(chalk.blue('\n1️⃣ Testing game endpoint...'));
      const gameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.id}/feed/live`;
      const gameResp = await axios.get(gameUrl);
      
      console.log(chalk.green('✅ Game data found'));
      console.log(`   Teams: ${gameResp.data.gameData?.teams?.away?.name} @ ${gameResp.data.gameData?.teams?.home?.name}`);
      console.log(`   Status: ${gameResp.data.gameData?.status?.detailedState}`);
      
      // 2. Check if boxscore exists
      console.log(chalk.blue('\n2️⃣ Checking boxscore...'));
      const hasBoxscore = gameResp.data.liveData?.boxscore;
      const hasStats = hasBoxscore?.teams?.away?.players && Object.keys(hasBoxscore.teams.away.players).length > 0;
      
      if (hasBoxscore) {
        console.log(chalk.green('✅ Boxscore object exists'));
        console.log(`   Has player data: ${hasStats ? 'YES' : 'NO'}`);
        
        if (hasStats) {
          const awayPlayers = Object.keys(hasBoxscore.teams.away.players || {});
          const homePlayers = Object.keys(hasBoxscore.teams.home.players || {});
          console.log(`   Away players: ${awayPlayers.length}`);
          console.log(`   Home players: ${homePlayers.length}`);
          
          // Check first player's stats
          if (awayPlayers.length > 0) {
            const firstPlayerId = awayPlayers[0];
            const player = hasBoxscore.teams.away.players[firstPlayerId];
            console.log(chalk.cyan('\n   Sample player data:'));
            console.log(`   Name: ${player.person?.fullName}`);
            console.log(`   Has stats: ${player.stats ? 'YES' : 'NO'}`);
            if (player.stats) {
              console.log(`   Stats keys: ${Object.keys(player.stats).join(', ')}`);
            }
          }
        }
      } else {
        console.log(chalk.red('❌ No boxscore data'));
      }
      
      // 3. Try direct boxscore endpoint
      console.log(chalk.blue('\n3️⃣ Testing direct boxscore endpoint...'));
      const boxscoreUrl = `https://statsapi.mlb.com/api/v1/game/${game.id}/boxscore`;
      try {
        const boxResp = await axios.get(boxscoreUrl);
        console.log(chalk.green('✅ Direct boxscore endpoint works'));
        
        const teams = boxResp.data.teams;
        if (teams?.away?.players && teams?.home?.players) {
          const awayPlayerIds = Object.keys(teams.away.players);
          const homePlayerIds = Object.keys(teams.home.players);
          console.log(`   Away players: ${awayPlayerIds.length}`);
          console.log(`   Home players: ${homePlayerIds.length}`);
          
          // Check stats structure
          if (awayPlayerIds.length > 0) {
            const samplePlayer = teams.away.players[awayPlayerIds[0]];
            console.log(chalk.cyan('\n   Player structure:'));
            console.log(`   Keys: ${Object.keys(samplePlayer).join(', ')}`);
            
            if (samplePlayer.stats) {
              console.log(`   Stats categories: ${Object.keys(samplePlayer.stats).join(', ')}`);
              if (samplePlayer.stats.batting) {
                console.log(`   Batting stats: ${Object.keys(samplePlayer.stats.batting).join(', ')}`);
              }
              if (samplePlayer.stats.pitching) {
                console.log(`   Pitching stats: ${Object.keys(samplePlayer.stats.pitching).join(', ')}`);
              }
            }
          }
        }
      } catch (error: any) {
        console.log(chalk.red('❌ Direct boxscore failed:', error.message));
      }
      
      // 4. Check play-by-play
      console.log(chalk.blue('\n4️⃣ Checking play-by-play data...'));
      const hasPlays = gameResp.data.liveData?.plays?.allPlays?.length > 0;
      console.log(`   Has play data: ${hasPlays ? 'YES' : 'NO'}`);
      if (hasPlays) {
        console.log(`   Total plays: ${gameResp.data.liveData.plays.allPlays.length}`);
      }
      
    } catch (error: any) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      if (error.response?.status === 404) {
        console.log(chalk.yellow('   Game not found (might be too old or not tracked)'));
      }
    }
  }
  
  // Test roster endpoint
  console.log(chalk.yellow('\n\n━━━ Testing MiLB Roster Endpoints ━━━'));
  
  const testTeams = [
    { id: 134, name: 'Toledo Mud Hens', level: 11 },
    { id: 552, name: 'Sacramento River Cats', level: 11 }
  ];
  
  for (const team of testTeams) {
    console.log(chalk.blue(`\nTesting ${team.name} (ID: ${team.id})...`));
    
    try {
      // Standard roster endpoint
      const rosterUrl = `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster`;
      const rosterResp = await axios.get(rosterUrl);
      console.log(chalk.green(`✅ Roster found: ${rosterResp.data.roster?.length || 0} players`));
      
      // Try with sportId
      const rosterUrl2 = `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?sportId=${team.level}`;
      const rosterResp2 = await axios.get(rosterUrl2);
      console.log(chalk.green(`✅ Roster with sportId: ${rosterResp2.data.roster?.length || 0} players`));
      
    } catch (error: any) {
      console.log(chalk.red(`❌ Roster error: ${error.message}`));
    }
  }
  
  console.log(chalk.cyan('\n\n🔍 DIAGNOSIS COMPLETE\n'));
}

diagnoseMiLBAPI().catch(console.error);