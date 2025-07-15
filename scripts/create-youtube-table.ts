#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createYouTubeTable() {
  console.log('📋 Creating YouTube insights table...\n');
  
  // Create the table using Supabase SQL editor
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS youtube_fantasy_insights (
        id SERIAL PRIMARY KEY,
        video_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        channel TEXT,
        published_at TIMESTAMP,
        players_mentioned TEXT[],
        positive_mentions TEXT[],
        negative_mentions TEXT[],
        injury_mentions TEXT[],
        key_insights TEXT[],
        url TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_youtube_video_id ON youtube_fantasy_insights(video_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_published ON youtube_fantasy_insights(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_youtube_players ON youtube_fantasy_insights USING GIN(players_mentioned);
    `
  });
  
  if (error) {
    console.error('Error creating table:', error);
    // Try a simpler approach
    console.log('Trying alternative approach...');
    
    // Check if table exists
    const { data: tables } = await supabase
      .from('youtube_fantasy_insights')
      .select('*')
      .limit(1);
      
    if (tables === null) {
      console.log('❌ Table does not exist. Please create it in Supabase dashboard.');
      console.log('\nSQL to run in Supabase SQL editor:');
      console.log(`
CREATE TABLE youtube_fantasy_insights (
  id SERIAL PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  channel TEXT,
  published_at TIMESTAMP,
  players_mentioned TEXT[],
  positive_mentions TEXT[],
  negative_mentions TEXT[],
  injury_mentions TEXT[],
  key_insights TEXT[],
  url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_youtube_video_id ON youtube_fantasy_insights(video_id);
CREATE INDEX idx_youtube_published ON youtube_fantasy_insights(published_at DESC);
CREATE INDEX idx_youtube_players ON youtube_fantasy_insights USING GIN(players_mentioned);
      `);
    } else {
      console.log('✅ Table already exists!');
    }
  } else {
    console.log('✅ Table created successfully!');
  }
}

createYouTubeTable().catch(console.error);