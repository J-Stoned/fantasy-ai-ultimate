/**
 * Lineup Optimizer Route Wrapper
 * Redirects to simple optimizer when GPU optimizer is not available
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Try the GPU optimizer first (if available in future)
    // For now, always use the simple optimizer
    
    // Forward to simple optimizer
    const response = await fetch(new URL('/api/optimize/lineup/simple', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Optimizer wrapper error:', error);
    return NextResponse.json(
      { error: 'Failed to optimize lineup', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return info about the optimizer
  return NextResponse.json({
    endpoint: '/api/optimize/lineup',
    description: 'Lineup optimizer endpoint',
    implementations: {
      gpu: 'GPU-accelerated optimizer (requires GPU service)',
      simple: 'Simple knapsack optimizer (always available)'
    },
    currentMode: 'simple',
    usage: 'POST with sport, contest, and budget parameters'
  });
}