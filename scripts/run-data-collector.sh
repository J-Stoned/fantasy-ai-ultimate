#!/bin/bash
# Run data collector with proper environment

cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate

# Export environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://pvekvqiqrrpugfmpgaup.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
export DATABASE_URL="${DATABASE_URL}"
export BALLDONTLIE_API_KEY="59de4292-dfc4-4a8a-b337-1e804f4109c6"
export THE_ODDS_API_KEY="c4122ff7d8e3da9371cb8043db05bc41"
export OPENWEATHER_API_KEY="80f38063e593f0b02b0f2cf7d4878ff5"
export NEWS_API_KEY="eb9e2ead25574a658620b64c7b506012"
export YOUTUBE_API_KEY="AIzaSyA4lnRjUEDVhkGQ7yeg9GE0LBgBqDC2GsM"

# Run the UUID-fixed collector with proper game_id handling
npx tsx scripts/uuid-fixed-collector.ts