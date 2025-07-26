/**
 * 🔥 CDN Deployment Script
 * 
 * Run this script to deploy Cloudflare CDN edge workers and configuration
 * Usage: npm run deploy:cdn
 */

import { cloudflareCDNService } from '../apps/web/src/lib/services/cdn/cloudflare-service';
import { initializeCDN, runCDNDiagnostics } from '../apps/web/src/lib/services/cdn/initialize-cdn';
import { logger } from '../apps/web/src/lib/logging/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Verify required environment variables
const requiredEnvVars = [
  'CLOUDFLARE_ZONE_ID',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease add these to your .env.local file');
  process.exit(1);
}

async function deployCDN() {
  console.log('🚀 Starting CDN deployment...\n');

  try {
    // Step 1: Initialize CDN
    console.log('🔧 Initializing CDN configuration...');
    const initResult = await initializeCDN();
    
    if (!initResult.success) {
      console.error('❌ CDN initialization failed:', initResult.message);
      console.error('Details:', initResult.details);
      process.exit(1);
    }
    
    console.log('✅ CDN initialization:', initResult.message);
    console.log('Details:', JSON.stringify(initResult.details, null, 2));
    console.log('');

    // Step 2: Run diagnostics
    console.log('📊 Running CDN diagnostics...');
    const diagnostics = await runCDNDiagnostics();
    
    console.log(`Status: ${diagnostics.status}`);
    console.log('\nHealth Checks:');
    Object.entries(diagnostics.checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    });
    
    if (diagnostics.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      diagnostics.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    // Step 3: Test image optimization
    console.log('\n🖼️ Testing image optimization...');
    const testImageUrl = 'https://example.com/test-image.jpg';
    const optimizedUrl = cloudflareCDNService.getOptimizedImageUrl(testImageUrl, {
      width: 300,
      format: 'webp',
      quality: 85
    });
    console.log('Original URL:', testImageUrl);
    console.log('Optimized URL:', optimizedUrl);

    // Step 4: Get performance metrics
    console.log('\n📈 Fetching performance metrics...');
    const metrics = await cloudflareCDNService.getPerformanceAnalytics('hour');
    
    console.log(`Cache Hit Rate: ${metrics.cacheHitRate.toFixed(2)}%`);
    console.log(`Bandwidth Saved: ${formatBytes(metrics.bandwidthSaved)}`);
    console.log(`Requests Served: ${metrics.requestsServed.toLocaleString()}`);
    console.log(`Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`Edge Locations: ${metrics.edgeLocations.length}`);

    console.log('\n🎆 CDN deployment completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your domain DNS to point to Cloudflare nameservers');
    console.log('2. Enable additional Cloudflare features in the dashboard');
    console.log('3. Monitor performance in the CDN Analytics dashboard');
    console.log('4. Set up Page Rules for specific caching strategies');

  } catch (error) {
    console.error('\n❌ Deployment error:', error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run deployment
deployCDN();