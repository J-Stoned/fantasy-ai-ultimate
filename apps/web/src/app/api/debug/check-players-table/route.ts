import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if players table exists and what columns it has
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'players' });
    
    // If that doesn't work, try a different approach
    if (columnsError) {
      // Try to select a single row to see the structure
      const { data: sample, error: sampleError } = await supabase
        .from('players')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        return NextResponse.json({
          success: false,
          error: 'Could not access players table',
          details: sampleError.message
        });
      }
      
      // Get column names from the sample
      const columnNames = sample && sample.length > 0 ? Object.keys(sample[0]) : [];
      
      return NextResponse.json({
        success: true,
        method: 'sample_query',
        columns: columnNames,
        hasImageUrl: columnNames.includes('image_url'),
        sampleRow: sample?.[0] || null
      });
    }
    
    return NextResponse.json({
      success: true,
      method: 'rpc',
      columns: columns,
      hasImageUrl: columns?.some((col: any) => col.column_name === 'image_url')
    });
    
  } catch (error) {
    logger.error('Failed to check players table:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check database structure',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}