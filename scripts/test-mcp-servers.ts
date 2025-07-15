#!/usr/bin/env npx tsx

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Read MCP configuration
const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));

// Server test results
const results: { [key: string]: { status: string; error?: string } } = {};

// Test each MCP server
async function testServer(name: string, config: any): Promise<void> {
  console.log(`\n🔍 Testing ${name}...`);
  
  return new Promise((resolve) => {
    try {
      // Set up environment variables
      const env = { ...process.env };
      if (config.env) {
        Object.assign(env, config.env);
      }

      // Spawn the server process
      const proc = spawn(config.command, config.args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';
      let timeout: NodeJS.Timeout;

      // Capture output
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Set a timeout to kill the process
      timeout = setTimeout(() => {
        proc.kill();
        
        // Check if server started successfully
        if (stderr.includes('Error') || stderr.includes('error')) {
          results[name] = { 
            status: '❌ Failed', 
            error: stderr.slice(0, 200) 
          };
        } else if (stdout.includes('Server started') || stdout.includes('Listening') || !stderr) {
          results[name] = { status: '✅ Success' };
        } else {
          results[name] = { status: '⚠️  Started (check output)' };
        }
        
        resolve();
      }, 3000);

      proc.on('error', (err) => {
        clearTimeout(timeout);
        results[name] = { 
          status: '❌ Failed', 
          error: err.message 
        };
        resolve();
      });

      proc.on('exit', () => {
        clearTimeout(timeout);
        if (!results[name]) {
          results[name] = { status: '✅ Success' };
        }
        resolve();
      });

    } catch (err) {
      results[name] = { 
        status: '❌ Failed', 
        error: err instanceof Error ? err.message : String(err) 
      };
      resolve();
    }
  });
}

// Main function
async function main() {
  console.log('🚀 MCP Server Test Suite');
  console.log('========================');
  console.log(`Testing ${Object.keys(mcpConfig.mcpServers).length} servers...\n`);

  // Test servers in batches to avoid overload
  const serverEntries = Object.entries(mcpConfig.mcpServers);
  const batchSize = 5;
  
  for (let i = 0; i < serverEntries.length; i += batchSize) {
    const batch = serverEntries.slice(i, i + batchSize);
    await Promise.all(
      batch.map(([name, config]) => testServer(name, config as any))
    );
  }

  // Print results
  console.log('\n\n📊 Test Results');
  console.log('================');
  
  const successful = Object.values(results).filter(r => r.status.includes('✅')).length;
  const failed = Object.values(results).filter(r => r.status.includes('❌')).length;
  const warnings = Object.values(results).filter(r => r.status.includes('⚠️')).length;
  
  console.log(`\nSummary: ${successful} successful, ${warnings} warnings, ${failed} failed\n`);
  
  // Group by status
  console.log('✅ Successful Servers:');
  Object.entries(results)
    .filter(([_, r]) => r.status.includes('✅'))
    .forEach(([name, _]) => console.log(`  - ${name}`));
  
  if (warnings > 0) {
    console.log('\n⚠️  Servers with Warnings:');
    Object.entries(results)
      .filter(([_, r]) => r.status.includes('⚠️'))
      .forEach(([name, _]) => console.log(`  - ${name}`));
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed Servers:');
    Object.entries(results)
      .filter(([_, r]) => r.status.includes('❌'))
      .forEach(([name, r]) => {
        console.log(`  - ${name}`);
        if (r.error) {
          console.log(`    Error: ${r.error.slice(0, 100)}...`);
        }
      });
  }

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: { successful, warnings, failed, total: serverEntries.length },
    results
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'mcp-test-results.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n💾 Detailed report saved to mcp-test-results.json');
}

// Run tests
main().catch(console.error);