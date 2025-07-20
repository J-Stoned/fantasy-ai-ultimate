#!/usr/bin/env node
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeploymentStep {
  name: string;
  command: string;
  args: string[];
  critical: boolean;
}

async function deployMVP() {
  console.log('🚀 Fantasy AI MVP Deployment Pipeline\n');
  console.log('=' .repeat(50));
  
  const steps: DeploymentStep[] = [
    {
      name: 'Install Dependencies',
      command: 'npm',
      args: ['install'],
      critical: true
    },
    {
      name: 'Create Model Directory',
      command: 'mkdir',
      args: ['-p', 'models'],
      critical: false
    },
    {
      name: 'Train ML Models',
      command: 'npx',
      args: ['ts-node', 'scripts/fantasy-ml/train-models.ts'],
      critical: true
    },
    {
      name: 'Test DFS Collector',
      command: 'npx',
      args: ['ts-node', 'scripts/fantasy-ml/test-dfs-collector.ts'],
      critical: false
    },
    {
      name: 'Start Production API',
      command: 'npx',
      args: ['ts-node', 'scripts/fantasy-ml/services/fantasy-api-service.ts'],
      critical: true
    }
  ];
  
  // Environment check
  console.log('🔍 Checking environment variables...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    console.log('\n📝 Please add these to your .env file:');
    missingVars.forEach(v => {
      console.log(`${v}=your_value_here`);
    });
    process.exit(1);
  }
  console.log('✅ Environment variables OK\n');
  
  // Execute deployment steps
  for (const step of steps) {
    console.log(`\n🔧 ${step.name}...`);
    
    try {
      await executeCommand(step.command, step.args);
      console.log(`✅ ${step.name} completed`);
    } catch (error) {
      console.error(`❌ ${step.name} failed:`, error);
      if (step.critical) {
        console.error('💥 Critical step failed, aborting deployment');
        process.exit(1);
      } else {
        console.warn('⚠️  Non-critical step failed, continuing...');
      }
    }
  }
  
  // Create PM2 ecosystem file for production
  console.log('\n📝 Creating PM2 ecosystem file...');
  const pm2Config = {
    apps: [{
      name: 'fantasy-ai-api',
      script: './scripts/fantasy-ml/services/fantasy-api-service.ts',
      interpreter: 'npx',
      interpreter_args: 'ts-node',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      time: true
    }, {
      name: 'dfs-collector',
      script: './scripts/fantasy-ml/services/dfs-data-collector.ts',
      interpreter: 'npx',
      interpreter_args: 'ts-node',
      cron_restart: '0 10,14,18 * * *', // Run 3 times daily
      env: {
        NODE_ENV: 'production'
      }
    }]
  };
  
  await fs.writeFile('ecosystem.config.js', `module.exports = ${JSON.stringify(pm2Config, null, 2)}`);
  console.log('✅ PM2 config created');
  
  // Create startup script
  console.log('\n📝 Creating startup script...');
  const startupScript = `#!/bin/bash
# Fantasy AI Production Startup Script

echo "🚀 Starting Fantasy AI Services..."

# Start API with PM2
pm2 start ecosystem.config.js

# Show status
pm2 status

echo "✅ Fantasy AI is running!"
echo ""
echo "📊 API Endpoints:"
echo "  - http://localhost:3001/api/player/:playerId/projection"
echo "  - http://localhost:3001/api/dfs/optimize"
echo "  - http://localhost:3001/api/props/analyze"
echo ""
echo "🔐 Get your API key at: http://localhost:3000/subscribe"
echo ""
echo "📈 Monitor logs with: pm2 logs"
`;
  
  await fs.writeFile('start-production.sh', startupScript);
  await fs.chmod('start-production.sh', '755');
  console.log('✅ Startup script created');
  
  // Final summary
  console.log('\n' + '=' .repeat(50));
  console.log('🎉 MVP Deployment Complete!\n');
  console.log('📋 Next Steps:');
  console.log('  1. Run ./start-production.sh to start services');
  console.log('  2. Set up Stripe webhook endpoint');
  console.log('  3. Create landing page at http://localhost:3000');
  console.log('  4. Start marketing to DFS players!');
  console.log('\n💰 Revenue Projections:');
  console.log('  - 100 Pro users: $2,999/month');
  console.log('  - 20 Elite users: $1,999/month');
  console.log('  - Total MRR: $4,998/month');
  console.log('\n🚀 10X YOUR DFS GAME WITH AI!');
}

function executeCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

// Run deployment
deployMVP().catch(error => {
  console.error('💥 Deployment failed:', error);
  process.exit(1);
});