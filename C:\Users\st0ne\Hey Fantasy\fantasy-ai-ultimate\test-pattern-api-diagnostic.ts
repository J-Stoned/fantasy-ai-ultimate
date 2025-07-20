// test-pattern-api-diagnostic.ts
import express from 'express';
import { queryMany } from './scripts/utils/local-db-pool.js';
import { FIXED_PATTERN_QUERIES } from './scripts/pattern-detection/fix-pattern-queries-v3.js';

const app = express();

// Simplified middleware - just set req.user and req.tier
app.use((req, res, next) => {
  req.user = { id: 'test', tier: 'starter' };
  req.tier = 'starter';
  next();
});

app.get('/patterns/:pattern', async (req, res) => {
  const { pattern } = req.params;
  const limit = parseInt(req.query.limit) || 5;
  const offset = parseInt(req.query.offset) || 0;
  
  console.log(`\n=== DIAGNOSTIC: Pattern ${pattern} ===`);
  console.log('1. Request params:', { pattern, limit, offset });
  
  if (!FIXED_PATTERN_QUERIES[pattern]) {
    console.log('2. Pattern not found in FIXED_PATTERN_QUERIES');
    return res.status(404).json({ error: 'Pattern not found' });
  }
  
  console.log('2. Pattern found, building query...');
  const baseQuery = FIXED_PATTERN_QUERIES[pattern];
  const query = `${baseQuery} LIMIT $1 OFFSET $2`;
  
  console.log('3. Query built, executing...');
  console.log('   Base query length:', baseQuery.length);
  console.log('   Full query length:', query.length);
  
  try {
    const results = await queryMany(query, [limit, offset]);
    console.log('4. Query executed successfully');
    console.log('   Results type:', typeof results);
    console.log('   Results is array:', Array.isArray(results));
    console.log('   Results length:', results.length);
    
    if (results.length > 0) {
      console.log('   First result keys:', Object.keys(results[0]));
    }
    
    const response = {
      success: true,
      pattern,
      data: results,
      count: results.length,
      limit,
      offset
    };
    
    console.log('5. Response object created');
    console.log('   Response.data type:', typeof response.data);
    console.log('   Response.data is array:', Array.isArray(response.data));
    console.log('   Response.data length:', response.data.length);
    console.log('   Response.count:', response.count);
    
    console.log('6. Sending response...');
    res.json(response);
    console.log('7. Response sent');
    
  } catch (error) {
    console.log('4. ERROR executing query:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3339, () => {
  console.log('Diagnostic API running on http://localhost:3339');
  console.log('Test with: http://localhost:3339/patterns/altitudeAdvantage?limit=5');
});