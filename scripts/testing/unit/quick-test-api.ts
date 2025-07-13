// Quick API test script
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/v3/ultimate-stats';

async function quickTest() {
  console.log('🧪 QUICK ULTIMATE STATS API TEST\n');
  
  const tests = [
    {
      name: 'Main endpoint',
      url: `${BASE_URL}?limit=5`
    },
    {
      name: 'NBA stats',
      url: `${BASE_URL}?sport=NBA&limit=3`
    },
    {
      name: 'Live games',
      url: `${BASE_URL}?live=true`
    },
    {
      name: 'Specific metrics',
      url: `${BASE_URL}?metrics=fantasy_points_estimate,true_shooting_pct&limit=3`
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📍 Testing: ${test.name}`);
      console.log(`   URL: ${test.url}`);
      
      const start = Date.now();
      const response = await fetch(test.url);
      const data = await response.json();
      const duration = Date.now() - start;
      
      if (response.ok) {
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   ⏱️  Response time: ${duration}ms`);
        if (data.data) {
          console.log(`   📊 Records: ${Array.isArray(data.data) ? data.data.length : 'N/A'}`);
        }
        if (data.meta) {
          console.log(`   📈 Total: ${data.meta.total || 'N/A'}`);
        }
      } else {
        console.log(`   ❌ Status: ${response.status}`);
        console.log(`   Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n✅ Quick test complete!');
}

quickTest().catch(console.error);