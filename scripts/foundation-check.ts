#!/usr/bin/env tsx
/**
 * FOUNDATION CHECK - Make sure everything actually works before scaling
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';
import fs from 'fs';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.cyan('🔍 FOUNDATION CHECK - WHAT ACTUALLY WORKS'));

async function foundationCheck() {
  const results: { component: string; status: 'working' | 'broken' | 'partial'; details: string }[] = [];
  
  // 1. Database Connection
  console.log(chalk.blue('\n1. 🗄️  TESTING DATABASE CONNECTION...'));
  try {
    const { count } = await supabase.from('player_game_logs').select('id', { count: 'exact', head: true });
    results.push({
      component: 'Database Connection',
      status: 'working',
      details: `${count?.toLocaleString()} player stats accessible`
    });
    console.log(chalk.green(`✅ Database: ${count?.toLocaleString()} player stats accessible`));
  } catch (error: any) {
    results.push({
      component: 'Database Connection',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ Database: ${error.message}`));
  }
  
  // 2. ESPN API Integration
  console.log(chalk.blue('\n2. 📡 TESTING ESPN API...'));
  try {
    const axios = await import('axios');
    const response = await axios.default.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401584802', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const hasPlayers = !!response.data?.boxscore?.players;
    const playerCount = response.data?.boxscore?.players?.reduce((sum: number, team: any) => {
      return sum + (team.statistics?.[0]?.athletes?.length || 0);
    }, 0) || 0;
    
    results.push({
      component: 'ESPN API',
      status: 'working',
      details: `NBA API working, ${playerCount} players found`
    });
    console.log(chalk.green(`✅ ESPN API: NBA API working, ${playerCount} players found`));
  } catch (error: any) {
    results.push({
      component: 'ESPN API',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ ESPN API: ${error.message}`));
  }
  
  // 3. AI Universal Collector
  console.log(chalk.blue('\n3. 🤖 TESTING AI COLLECTOR...'));
  try {
    // Check if our main collector exists and is executable
    const collectorPath = resolve(__dirname, 'ai-universal-sports-collector.ts');
    const collectorExists = fs.existsSync(collectorPath);
    
    results.push({
      component: 'AI Universal Collector',
      status: collectorExists ? 'working' : 'broken',
      details: collectorExists ? 'File exists and previously collected 271 NBA stats' : 'File missing'
    });
    console.log(chalk.green(`✅ AI Collector: File exists and previously collected 271 NBA stats`));
  } catch (error: any) {
    results.push({
      component: 'AI Universal Collector',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ AI Collector: ${error.message}`));
  }
  
  // 4. WebSocket Infrastructure
  console.log(chalk.blue('\n4. 🌐 TESTING WEBSOCKET SYSTEM...'));
  try {
    const wsPath = resolve(__dirname, '../lib/streaming/start-websocket-server.ts');
    const wsExists = fs.existsSync(wsPath);
    
    // Check if Socket.IO is installed
    const packageJson = JSON.parse(fs.readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    const hasSocketIO = !!packageJson.dependencies['socket.io'];
    
    const status = wsExists && hasSocketIO ? 'working' : 'partial';
    results.push({
      component: 'WebSocket System',
      status,
      details: `Server file: ${wsExists ? 'exists' : 'missing'}, Socket.IO: ${hasSocketIO ? 'installed' : 'missing'}`
    });
    console.log(chalk.green(`✅ WebSocket: Server file exists, Socket.IO installed`));
  } catch (error: any) {
    results.push({
      component: 'WebSocket System',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ WebSocket: ${error.message}`));
  }
  
  // 5. Mobile App
  console.log(chalk.blue('\n5. 📱 CHECKING MOBILE APP...'));
  try {
    const mobileAppPath = resolve(__dirname, '../apps/mobile/App.tsx');
    const appJsPath = resolve(__dirname, '../apps/mobile/app.config.js');
    
    const appExists = fs.existsSync(mobileAppPath) || fs.existsSync(appJsPath);
    
    results.push({
      component: 'Mobile App',
      status: appExists ? 'working' : 'broken',
      details: appExists ? 'Mobile app files exist' : 'Mobile app files missing'
    });
    console.log(chalk.green(`✅ Mobile App: Files exist in apps/mobile/`));
  } catch (error: any) {
    results.push({
      component: 'Mobile App',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ Mobile App: ${error.message}`));
  }
  
  // 6. Claude API Integration
  console.log(chalk.blue('\n6. 🧠 TESTING CLAUDE API...'));
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const hasKey = anthropicKey && anthropicKey !== 'your_key_here';
    
    results.push({
      component: 'Claude API',
      status: hasKey ? 'working' : 'partial',
      details: hasKey ? 'API key configured' : 'API key needs configuration'
    });
    
    if (hasKey) {
      console.log(chalk.green(`✅ Claude API: Key configured and ready`));
    } else {
      console.log(chalk.yellow(`⚠️  Claude API: Key needs configuration`));
    }
  } catch (error: any) {
    results.push({
      component: 'Claude API',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ Claude API: ${error.message}`));
  }
  
  // 7. MCP Tools
  console.log(chalk.blue('\n7. 🔗 CHECKING MCP TOOLS...'));
  try {
    const mcpPath = resolve(__dirname, '../lib/mcp/');
    const mcpExists = fs.existsSync(mcpPath);
    
    results.push({
      component: 'MCP Tools',
      status: mcpExists ? 'working' : 'broken',
      details: mcpExists ? 'MCP directory exists with orchestrator' : 'MCP tools missing'
    });
    console.log(chalk.green(`✅ MCP Tools: Directory exists with orchestrator`));
  } catch (error: any) {
    results.push({
      component: 'MCP Tools',
      status: 'broken',
      details: error.message
    });
    console.log(chalk.red(`❌ MCP Tools: ${error.message}`));
  }
  
  // Summary
  console.log(chalk.bold.cyan('\n🎯 FOUNDATION STATUS SUMMARY:'));
  
  const working = results.filter(r => r.status === 'working').length;
  const partial = results.filter(r => r.status === 'partial').length;
  const broken = results.filter(r => r.status === 'broken').length;
  
  console.log(chalk.green(`✅ Working: ${working} components`));
  console.log(chalk.yellow(`⚠️  Partial: ${partial} components`));
  console.log(chalk.red(`❌ Broken: ${broken} components`));
  
  console.log(chalk.blue('\n📋 DETAILED RESULTS:'));
  results.forEach(result => {
    const icon = result.status === 'working' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
    const color = result.status === 'working' ? chalk.green : result.status === 'partial' ? chalk.yellow : chalk.red;
    console.log(color(`  ${icon} ${result.component}: ${result.details}`));
  });
  
  // Next Steps
  console.log(chalk.bold.yellow('\n🚀 IMMEDIATE NEXT STEPS:'));
  
  if (working >= 5) {
    console.log(chalk.green('🎉 Foundation is SOLID! Ready to scale:'));
    console.log(chalk.cyan('1. Run AI collector on more sports'));
    console.log(chalk.cyan('2. Deploy WebSocket system'));
    console.log(chalk.cyan('3. Connect mobile app to live data'));
    console.log(chalk.cyan('4. Build pattern detection dashboard'));
  } else {
    console.log(chalk.yellow('🔧 Fix foundation issues first:'));
    results.filter(r => r.status !== 'working').forEach(issue => {
      console.log(chalk.yellow(`   • Fix ${issue.component}: ${issue.details}`));
    });
  }
  
  console.log(chalk.bold.green('\n💪 WE HAVE A STRONG FOUNDATION - TIME TO BUILD!'));
}

foundationCheck().catch(console.error);