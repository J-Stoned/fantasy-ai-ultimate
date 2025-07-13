#!/bin/bash
# Run NCAA photo collector

cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate

# Export environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://pvekvqiqrrpugfmpgaup.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Run the NCAA collector
npx tsx scripts/ncaa-photo-collector.ts