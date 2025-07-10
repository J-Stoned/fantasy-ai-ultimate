#!/bin/bash
# Run mega photo collector for all sports

cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate

# Export environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://pvekvqiqrrpugfmpgaup.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Run the all sports photo collector
npx tsx scripts/all-sports-photo-collector.ts