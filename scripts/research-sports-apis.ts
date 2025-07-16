#!/usr/bin/env tsx
/**
 * 🔬 SPORTS API RESEARCH TOOL
 * 
 * Comprehensive testing of all sports APIs to understand structures,
 * data formats, and requirements for reliable player collection
 */

import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';

interface APITestResult {
  sport: string;
  api_name: string;
  base_url: string;
  test_endpoint: string;
  status: 'success' | 'failed' | 'empty';
  player_count: number;
  sample_player?: any;
  data_structure?: any;
  error?: string;
  rate_limit?: string;
  auth_required?: boolean;
}

class SportsAPIResearcher {
  private results: APITestResult[] = [];

  async testMLBStatsAPI() {
    console.log(chalk.blue.bold('\n⚾ TESTING MLB STATS API\n'));
    
    try {
      // Test Kansas City Royals roster for 2024
      const teamId = 118;
      const season = 2024;
      const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?season=${season}`;
      
      console.log(`Testing: ${url}`);
      const response = await axios.get(url);
      
      const playerCount = response.data.roster?.length || 0;
      const samplePlayer = response.data.roster?.[0];
      
      console.log(chalk.green(`✅ Success! Found ${playerCount} players`));
      if (samplePlayer) {
        console.log('Sample player structure:');
        console.log(`- ID: ${samplePlayer.person.id}`);
        console.log(`- Name: ${samplePlayer.person.fullName}`);
        console.log(`- Position: ${samplePlayer.position.abbreviation}`);
        console.log(`- Jersey: ${samplePlayer.jerseyNumber}`);
      }
      
      this.results.push({
        sport: 'MLB',
        api_name: 'MLB Stats API',
        base_url: 'https://statsapi.mlb.com/api/v1',
        test_endpoint: url,
        status: playerCount > 0 ? 'success' : 'empty',
        player_count: playerCount,
        sample_player: samplePlayer,
        data_structure: {
          roster_path: 'data.roster',
          player_id: 'person.id',
          player_name: 'person.fullName',
          position: 'position.abbreviation',
          jersey: 'jerseyNumber'
        },
        auth_required: false,
        rate_limit: 'None specified'
      });
      
    } catch (error: any) {
      console.error(chalk.red(`❌ MLB API Error: ${error.message}`));
      this.results.push({
        sport: 'MLB',
        api_name: 'MLB Stats API',
        base_url: 'https://statsapi.mlb.com/api/v1',
        test_endpoint: '',
        status: 'failed',
        player_count: 0,
        error: error.message,
        auth_required: false
      });
    }
  }

  async testESPNNFLAPI() {
    console.log(chalk.blue.bold('\n🏈 TESTING ESPN NFL API\n'));
    
    try {
      // Test Kansas City Chiefs roster
      const teamId = 12;
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;
      
      console.log(`Testing: ${url}`);
      const response = await axios.get(url);
      
      let playerCount = 0;
      let samplePlayer = null;
      
      if (response.data.athletes) {
        for (const posGroup of response.data.athletes) {
          playerCount += posGroup.items?.length || 0;
          if (!samplePlayer && posGroup.items?.length > 0) {
            samplePlayer = posGroup.items[0];
          }
        }
      }
      
      console.log(chalk.green(`✅ Success! Found ${playerCount} players`));
      if (samplePlayer) {
        console.log('Sample player structure:');
        console.log(`- ID: ${samplePlayer.id}`);
        console.log(`- Name: ${samplePlayer.displayName}`);
        console.log(`- Position: ${samplePlayer.position?.abbreviation}`);
        console.log(`- Jersey: ${samplePlayer.jersey}`);
        console.log(`- Height: ${samplePlayer.height} (${typeof samplePlayer.height})`);
        console.log(`- Weight: ${samplePlayer.weight}`);
      }
      
      this.results.push({
        sport: 'NFL',
        api_name: 'ESPN NFL API',
        base_url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
        test_endpoint: url,
        status: playerCount > 0 ? 'success' : 'empty',
        player_count: playerCount,
        sample_player: samplePlayer,
        data_structure: {
          roster_path: 'data.athletes[].items[]',
          player_id: 'id',
          player_name: 'displayName',
          position: 'position.abbreviation',
          jersey: 'jersey',
          height: 'height (number)',
          weight: 'weight'
        },
        auth_required: false,
        rate_limit: 'None specified'
      });
      
    } catch (error: any) {
      console.error(chalk.red(`❌ NFL API Error: ${error.message}`));
      this.results.push({
        sport: 'NFL',
        api_name: 'ESPN NFL API',
        base_url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
        test_endpoint: '',
        status: 'failed',
        player_count: 0,
        error: error.message,
        auth_required: false
      });
    }
  }

  async testESPNNBAAPI() {
    console.log(chalk.blue.bold('\n🏀 TESTING ESPN NBA API\n'));
    
    try {
      // Test LA Lakers roster
      const teamId = 13;
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
      
      console.log(`Testing: ${url}`);
      const response = await axios.get(url);
      
      let playerCount = 0;
      let samplePlayer = null;
      
      if (response.data.athletes) {
        for (const posGroup of response.data.athletes) {
          playerCount += posGroup.items?.length || 0;
          if (!samplePlayer && posGroup.items?.length > 0) {
            samplePlayer = posGroup.items[0];
          }
        }
      }
      
      console.log(playerCount > 0 ? chalk.green(`✅ Success! Found ${playerCount} players`) : chalk.yellow(`⚠️ Empty roster (off-season?)`));
      
      this.results.push({
        sport: 'NBA',
        api_name: 'ESPN NBA API',
        base_url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
        test_endpoint: url,
        status: playerCount > 0 ? 'success' : 'empty',
        player_count: playerCount,
        sample_player: samplePlayer,
        auth_required: false,
        rate_limit: 'None specified'
      });
      
    } catch (error: any) {
      console.error(chalk.red(`❌ NBA ESPN API Error: ${error.message}`));
      this.results.push({
        sport: 'NBA',
        api_name: 'ESPN NBA API',
        base_url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
        test_endpoint: '',
        status: 'failed',
        player_count: 0,
        error: error.message,
        auth_required: false
      });
    }
  }

  async testNBAComAPI() {
    console.log(chalk.blue.bold('\n🏀 TESTING NBA.COM API (Alternative)\n'));
    
    try {
      // Test Lakers roster via NBA.com API
      const teamId = 1610612747; // Lakers team ID
      const season = '2024-25';
      const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${teamId}&Season=${season}`;
      
      console.log(`Testing: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://stats.nba.com/',
          'Origin': 'https://stats.nba.com'
        }
      });
      
      const playerCount = response.data.resultSets?.[0]?.rowSet?.length || 0;
      const samplePlayer = response.data.resultSets?.[0]?.rowSet?.[0];
      const headers = response.data.resultSets?.[0]?.headers;
      
      console.log(playerCount > 0 ? chalk.green(`✅ Success! Found ${playerCount} players`) : chalk.yellow(`⚠️ Empty roster`));
      
      if (samplePlayer && headers) {
        console.log('Sample player structure (array format):');
        headers.forEach((header: string, index: number) => {
          console.log(`- ${header}: ${samplePlayer[index]}`);
        });
      }
      
      this.results.push({
        sport: 'NBA',
        api_name: 'NBA.com Stats API',
        base_url: 'https://stats.nba.com/stats',
        test_endpoint: url,
        status: playerCount > 0 ? 'success' : 'empty',
        player_count: playerCount,
        sample_player: samplePlayer,
        data_structure: {
          roster_path: 'data.resultSets[0].rowSet',
          headers: 'data.resultSets[0].headers',
          format: 'Array with headers mapping'
        },
        auth_required: false,
        rate_limit: 'Headers required to prevent blocking'
      });
      
    } catch (error: any) {
      console.error(chalk.red(`❌ NBA.com API Error: ${error.message}`));
      this.results.push({
        sport: 'NBA',
        api_name: 'NBA.com Stats API',
        base_url: 'https://stats.nba.com/stats',
        test_endpoint: '',
        status: 'failed',
        player_count: 0,
        error: error.message,
        auth_required: false
      });
    }
  }

  async testESPNNHLAPI() {
    console.log(chalk.blue.bold('\n🏒 TESTING ESPN NHL API\n'));
    
    try {
      // Test Toronto Maple Leafs roster
      const teamId = 10;
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${teamId}/roster`;
      
      console.log(`Testing: ${url}`);
      const response = await axios.get(url);
      
      let playerCount = 0;
      let samplePlayer = null;
      
      if (response.data.athletes) {
        for (const posGroup of response.data.athletes) {
          playerCount += posGroup.items?.length || 0;
          if (!samplePlayer && posGroup.items?.length > 0) {
            samplePlayer = posGroup.items[0];
          }
        }
      }
      
      console.log(chalk.green(`✅ Success! Found ${playerCount} players`));
      if (samplePlayer) {
        console.log('Sample player structure:');
        console.log(`- ID: ${samplePlayer.id}`);
        console.log(`- Name: ${samplePlayer.displayName}`);
        console.log(`- Position: ${samplePlayer.position?.abbreviation}`);
        console.log(`- Jersey: ${samplePlayer.jersey}`);
        console.log(`- Height: ${samplePlayer.height} (${typeof samplePlayer.height})`);
        console.log(`- Weight: ${samplePlayer.weight}`);
      }
      
      this.results.push({
        sport: 'NHL',
        api_name: 'ESPN NHL API',
        base_url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl',
        test_endpoint: url,
        status: playerCount > 0 ? 'success' : 'empty',
        player_count: playerCount,
        sample_player: samplePlayer,
        data_structure: {
          roster_path: 'data.athletes[].items[]',
          player_id: 'id',
          player_name: 'displayName',
          position: 'position.abbreviation',
          jersey: 'jersey',
          height: 'height (number)',
          weight: 'weight'
        },
        auth_required: false,
        rate_limit: 'None specified'
      });
      
    } catch (error: any) {
      console.error(chalk.red(`❌ NHL API Error: ${error.message}`));
      this.results.push({
        sport: 'NHL',
        api_name: 'ESPN NHL API',
        base_url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl',
        test_endpoint: '',
        status: 'failed',
        player_count: 0,
        error: error.message,
        auth_required: false
      });
    }
  }

  async generateReport() {
    console.log(chalk.cyan.bold('\n📊 SPORTS API RESEARCH REPORT\n'));
    console.log(chalk.gray('═'.repeat(80)));
    
    // Summary table
    console.log(chalk.white.bold('\nAPI SUMMARY:'));
    this.results.forEach(result => {
      const status = result.status === 'success' ? chalk.green('✅') : 
                    result.status === 'empty' ? chalk.yellow('⚠️') : chalk.red('❌');
      console.log(`${status} ${result.sport.padEnd(4)} | ${result.api_name.padEnd(20)} | ${result.player_count.toString().padStart(3)} players`);
    });
    
    // Detailed findings
    console.log(chalk.white.bold('\nDETAILED FINDINGS:'));
    this.results.forEach(result => {
      console.log(chalk.yellow(`\n${result.sport} - ${result.api_name}:`));
      console.log(`  Status: ${result.status}`);
      console.log(`  Base URL: ${result.base_url}`);
      console.log(`  Players Found: ${result.player_count}`);
      console.log(`  Auth Required: ${result.auth_required ? 'Yes' : 'No'}`);
      console.log(`  Rate Limit: ${result.rate_limit || 'Unknown'}`);
      if (result.error) {
        console.log(chalk.red(`  Error: ${result.error}`));
      }
    });
    
    // Recommendations
    console.log(chalk.white.bold('\nRECOMMENDATIONS:'));
    const workingAPIs = this.results.filter(r => r.status === 'success');
    const emptyAPIs = this.results.filter(r => r.status === 'empty');
    const failedAPIs = this.results.filter(r => r.status === 'failed');
    
    console.log(chalk.green(`✅ Working APIs: ${workingAPIs.length}`));
    workingAPIs.forEach(api => {
      console.log(`   - ${api.sport}: Use ${api.api_name} (${api.player_count} players)`);
    });
    
    if (emptyAPIs.length > 0) {
      console.log(chalk.yellow(`⚠️ Empty APIs (off-season?): ${emptyAPIs.length}`));
      emptyAPIs.forEach(api => {
        console.log(`   - ${api.sport}: ${api.api_name} returned 0 players`);
      });
    }
    
    if (failedAPIs.length > 0) {
      console.log(chalk.red(`❌ Failed APIs: ${failedAPIs.length}`));
      failedAPIs.forEach(api => {
        console.log(`   - ${api.sport}: ${api.api_name} - ${api.error}`);
      });
    }
    
    // Save results to file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total_apis_tested: this.results.length,
        working: workingAPIs.length,
        empty: emptyAPIs.length,
        failed: failedAPIs.length
      },
      results: this.results
    };
    
    fs.writeFileSync('sports-api-research-report.json', JSON.stringify(reportData, null, 2));
    console.log(chalk.green('\n📄 Detailed report saved to: sports-api-research-report.json'));
  }

  async runAllTests() {
    console.log(chalk.magenta.bold('🔬 STARTING COMPREHENSIVE SPORTS API RESEARCH\n'));
    
    await this.testMLBStatsAPI();
    await this.testESPNNFLAPI();
    await this.testESPNNBAAPI();
    await this.testNBAComAPI();
    await this.testESPNNHLAPI();
    
    await this.generateReport();
  }
}

// Run the research
const researcher = new SportsAPIResearcher();
researcher.runAllTests()
  .then(() => {
    console.log(chalk.cyan('\n🎉 Research complete! Check the report for implementation guidance.'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Research failed:'), error);
    process.exit(1);
  });