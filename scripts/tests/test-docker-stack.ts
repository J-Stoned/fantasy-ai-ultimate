#!/usr/bin/env tsx
/**
 * TEST DOCKER STACK - Verify all services are ACTUALLY working!
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testDockerStack() {
  console.log(chalk.bold.cyan('\n🔥 TESTING FANTASY AI DOCKER STACK\n'));
  
  const tests = [
    {
      name: 'Docker Engine',
      command: 'docker version --format "{{.Server.Version}}"',
      expected: (output: string) => output.includes('.')
    },
    {
      name: 'Docker Compose',
      command: 'docker compose version --short',
      expected: (output: string) => output.includes('.')
    },
    {
      name: 'GPU Support',
      command: 'docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi',
      expected: (output: string) => output.includes('NVIDIA') || output.includes('GPU')
    },
    {
      name: 'Network Creation',
      command: 'docker network ls | grep -E "frontend|backend|monitoring"',
      expected: (output: string) => output.length > 0
    },
    {
      name: 'Redis Connection',
      command: 'docker run --rm --network host redis:7-alpine redis-cli -h localhost ping',
      expected: (output: string) => output.includes('PONG')
    },
    {
      name: 'Kafka Cluster',
      command: 'docker ps | grep kafka | wc -l',
      expected: (output: string) => parseInt(output) >= 3
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const { stdout } = await execAsync(test.command);
      if (test.expected(stdout.trim())) {
        console.log(chalk.green(`✅ ${test.name}: PASSED`));
        passed++;
      } else {
        console.log(chalk.red(`❌ ${test.name}: FAILED`));
        console.log(chalk.gray(`   Output: ${stdout.trim()}`));
        failed++;
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ ${test.name}: ERROR`));
      console.log(chalk.gray(`   Error: ${error.message}`));
      failed++;
    }
  }
  
  console.log(chalk.bold.yellow(`\n📊 Results: ${passed} passed, ${failed} failed\n`));
  
  if (failed === 0) {
    console.log(chalk.bold.green('🎉 ALL TESTS PASSED! Docker stack is ready!'));
    console.log(chalk.cyan('\nRun this to deploy:'));
    console.log(chalk.white('  ./scripts/docker-deploy.sh'));
  } else {
    console.log(chalk.bold.red('⚠️  Some tests failed. Fix issues before deploying.'));
  }
}

// Test current running services
async function testRunningServices() {
  console.log(chalk.bold.yellow('\n📦 Currently Running Services:\n'));
  
  try {
    const { stdout: containers } = await execAsync('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
    console.log(containers);
    
    const { stdout: pm2 } = await execAsync('pm2 list');
    console.log(chalk.bold.yellow('\n🔧 PM2 Services:\n'));
    console.log(pm2);
  } catch (error) {
    console.log(chalk.gray('No services running yet'));
  }
}

// Run tests
testDockerStack()
  .then(() => testRunningServices())
  .catch(console.error);