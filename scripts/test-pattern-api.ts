import axios from 'axios';

async function testPatternAPI() {
  console.log('🧪 TESTING PATTERN DETECTION API\n');
  console.log('=' .repeat(60));

  const baseURL = 'http://localhost:3338';

  try {
    // 1. Test health endpoint
    console.log('\n1. Testing /health endpoint:');
    const health = await axios.get(`${baseURL}/health`);
    console.log('Response:', JSON.stringify(health.data, null, 2));

    // 2. Try to find available endpoints
    console.log('\n2. Testing common endpoints:');
    
    const endpoints = [
      '/api/patterns',
      '/patterns',
      '/api/detect',
      '/detect',
      '/api/predictions',
      '/predictions',
      '/api/games',
      '/games',
      '/analyze',
      '/api/analyze'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${baseURL}${endpoint}`);
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
        if (response.data) {
          console.log(`   Data preview:`, JSON.stringify(response.data).substring(0, 200));
        }
      } catch (error: any) {
        console.log(`❌ ${endpoint} - ${error.response?.status || 'Failed'}`);
      }
    }

    // 3. Test POST endpoints
    console.log('\n3. Testing POST endpoints:');
    const postEndpoints = [
      { url: '/detect', data: { gameId: 1 } },
      { url: '/api/detect', data: { gameId: 1 } },
      { url: '/analyze', data: { gameId: 1 } },
      { url: '/api/analyze', data: { gameId: 1 } }
    ];

    for (const { url, data } of postEndpoints) {
      try {
        const response = await axios.post(`${baseURL}${url}`, data);
        console.log(`✅ POST ${url} - Status: ${response.status}`);
        if (response.data) {
          console.log(`   Response:`, JSON.stringify(response.data, null, 2));
        }
      } catch (error: any) {
        console.log(`❌ POST ${url} - ${error.response?.status || 'Failed'}`);
      }
    }

  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testPatternAPI();