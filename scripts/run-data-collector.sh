#!/bin/bash
# Run data collector with proper environment

cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate

# Export environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://pvekvqiqrrpugfmpgaup.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE"
export DATABASE_URL="postgresql://postgres:IL36Z9I7tV2629Lr@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres"
export BALLDONTLIE_API_KEY="59de4292-dfc4-4a8a-b337-1e804f4109c6"
export THE_ODDS_API_KEY="c4122ff7d8e3da9371cb8043db05bc41"
export OPENWEATHER_API_KEY="80f38063e593f0b02b0f2cf7d4878ff5"
export NEWS_API_KEY="eb9e2ead25574a658620b64c7b506012"
export YOUTUBE_API_KEY="AIzaSyA4lnRjUEDVhkGQ7yeg9GE0LBgBqDC2GsM"

# Run the collector
npx tsx scripts/production-ready-collector.ts