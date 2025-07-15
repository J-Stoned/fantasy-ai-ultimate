#!/usr/bin/env tsx
/**
 * 🔍 MCP Tools Diagnostic Script
 * Diagnoses why MCP tools aren't available in Claude Code
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

console.log(chalk.bold.red('\n🔍 MCP TOOLS DIAGNOSTIC\n'));

// 1. Check MCP configuration
console.log(chalk.yellow('1. Checking MCP Configuration...'));
const mcpConfigPath = '.mcp.json';
if (fs.existsSync(mcpConfigPath)) {
  const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
  const serverCount = Object.keys(config.mcpServers || {}).length;
  console.log(chalk.green(`✅ Found ${serverCount} MCP servers in .mcp.json`));
  console.log(chalk.gray('   Servers: ' + Object.keys(config.mcpServers || {}).slice(0, 5).join(', ') + '...'));
} else {
  console.log(chalk.red('❌ .mcp.json not found!'));
}

// 2. Check Claude settings
console.log(chalk.yellow('\n2. Checking Claude Settings...'));
const claudeSettingsPath = '.claude/settings.local.json';
if (fs.existsSync(claudeSettingsPath)) {
  const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf-8'));
  console.log(chalk.green(`✅ enableAllProjectMcpServers: ${settings.enableAllProjectMcpServers}`));
  console.log(chalk.gray(`   Enabled servers: ${settings.enabledMcpjsonServers?.join(', ') || 'none'}`));
} else {
  console.log(chalk.red('❌ .claude/settings.local.json not found!'));
}

// 3. Check running MCP processes
console.log(chalk.yellow('\n3. Checking Running MCP Processes...'));
const checkProcesses = spawn('ps', ['aux']);
let processOutput = '';

checkProcesses.stdout.on('data', (data) => {
  processOutput += data.toString();
});

checkProcesses.on('close', () => {
  const mcpProcesses = processOutput.split('\n').filter(line => 
    line.includes('mcp') || line.includes('modelcontextprotocol')
  );
  console.log(chalk.green(`✅ Found ${mcpProcesses.length} MCP processes running`));
  
  // 4. Test specific MCP server
  console.log(chalk.yellow('\n4. Testing Postgres MCP Server...'));
  testPostgresMCP();
});

function testPostgresMCP() {
  // Try to manually start postgres MCP and capture output
  console.log(chalk.gray('   Attempting to query postgres MCP...'));
  
  const postgresTest = spawn('npx', [
    '-y',
    '@modelcontextprotocol/server-postgres',
    '--help'
  ], {
    env: {
      ...process.env,
      POSTGRES_CONNECTION_STRING: 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres'
    }
  });

  postgresTest.stdout.on('data', (data) => {
    console.log(chalk.gray('   Output: ' + data.toString().trim()));
  });

  postgresTest.stderr.on('data', (data) => {
    console.log(chalk.red('   Error: ' + data.toString().trim()));
  });

  postgresTest.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green('   ✅ Postgres MCP responds to commands'));
    } else {
      console.log(chalk.red('   ❌ Postgres MCP failed with code: ' + code));
    }
    
    // 5. Check MCP tool permissions
    console.log(chalk.yellow('\n5. Checking MCP Tool Permissions...'));
    checkMCPPermissions();
  });
}

function checkMCPPermissions() {
  const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf-8'));
  const mcpPermissions = settings.permissions?.allow?.filter(p => p.includes('mcp__')) || [];
  
  if (mcpPermissions.length > 0) {
    console.log(chalk.green(`✅ Found ${mcpPermissions.length} MCP permissions`));
    mcpPermissions.forEach(p => console.log(chalk.gray(`   - ${p}`)));
  } else {
    console.log(chalk.red('❌ No MCP permissions found in settings'));
  }

  // 6. Diagnosis Summary
  console.log(chalk.bold.cyan('\n📋 DIAGNOSIS SUMMARY:\n'));
  
  console.log(chalk.yellow('Possible issues:'));
  console.log('1. MCP servers are running but not connected to Claude Code');
  console.log('2. Claude Code may need to be restarted with --mcp flag');
  console.log('3. MCP tool discovery mechanism may be broken');
  console.log('4. Environment variables may not be passed correctly');
  
  console.log(chalk.bold.green('\n🔧 RECOMMENDED FIXES:\n'));
  console.log('1. Restart Claude Code completely (close and reopen)');
  console.log('2. Check if there\'s a Claude Code update available');
  console.log('3. Try running: claude-code --debug --mcp');
  console.log('4. Check Claude Code logs for MCP errors');
  console.log('5. Ensure .mcp.json is in the project root');
  
  // Test if we can at least see the MCP tools in the allow list
  console.log(chalk.bold.yellow('\n🔍 CRITICAL FINDING:\n'));
  if (mcpPermissions.length === 0) {
    console.log(chalk.red('NO MCP TOOLS ARE IN THE PERMISSIONS LIST!'));
    console.log(chalk.yellow('This means Claude Code isn\'t loading MCP tools at all.'));
    console.log(chalk.cyan('\nThe issue is likely:'));
    console.log('- Claude Code needs to be restarted');
    console.log('- MCP feature may be disabled in Claude Code');
    console.log('- The .mcp.json file isn\'t being read on startup');
  } else {
    console.log(chalk.green('MCP tools ARE in permissions but not accessible.'));
    console.log(chalk.yellow('This suggests a runtime connection issue.'));
  }
}