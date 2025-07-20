#!/usr/bin/env tsx
/**
 * Minimal API test - no dependencies
 */

import express from 'express';

const app = express();

// Root route
app.get('/', (req, res) => {
  res.send('API is working!');
});

// Health route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Test successful', port: PORT });
});

const PORT = 3337;

app.listen(PORT, () => {
  console.log(`Minimal test API running on http://localhost:${PORT}`);
  console.log('Routes:');
  console.log('  GET /');
  console.log('  GET /health');
  console.log('  GET /test');
});