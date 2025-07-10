# GPU Stats Collector Player Loading Fix

## Issue Found
The GPU stats collector was only loading 1,000 players instead of all 22,225 players in the database due to Supabase's default query limit.

## Root Cause
- Supabase has a hard limit of 1,000 records per query
- The `getAllPlayers()` method in `master-collector.ts` wasn't using pagination
- Even with `limit(10000)` or `range(0, 25000)`, Supabase still returns only 1,000 records

## Impact
- Only 1,000 out of 22,225 players were in the cache
- Many player lookups would fail, requiring new player creation
- This could lead to duplicate players and incorrect stat associations

## Fix Applied
Updated the `getAllPlayers()` method in `/scripts/gpu-stats-collector/master-collector.ts` to:
1. First get the total count of players
2. Load players in batches of 1,000 using pagination
3. Show progress while loading
4. Return all players (22,225 total)

## Test Results
- Successfully loads all 22,225 players
- Creates a map with 16,208 unique external_ids
- Loading time: ~2.7 seconds
- Memory efficient with batch processing

## Code Changes
```typescript
// OLD CODE - Only loads 1,000 players
private async getAllPlayers(): Promise<any[]> {
  const { data, error } = await this.supabase
    .from('players')
    .select('id, external_id')
    .not('external_id', 'is', null);
  
  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }
  
  return data || [];
}

// NEW CODE - Loads all players with pagination
private async getAllPlayers(): Promise<any[]> {
  console.log(chalk.cyan('Loading all players from database...'));
  
  // First get the total count
  const { count } = await this.supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
  
  if (!count) {
    console.log(chalk.yellow('No players found'));
    return [];
  }
  
  console.log(chalk.yellow(`Found ${count} total players, loading in batches...`));
  
  // Paginate through all players
  const allPlayers: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  
  while (offset < count) {
    const { data, error } = await this.supabase
      .from('players')
      .select('id, external_id')
      .not('external_id', 'is', null)
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      throw new Error(`Failed to fetch players at offset ${offset}: ${error.message}`);
    }
    
    if (!data || data.length === 0) break;
    
    allPlayers.push(...data);
    offset += pageSize;
    
    // Show progress
    if (offset % 5000 === 0 || offset >= count) {
      console.log(chalk.gray(`  Loaded ${Math.min(offset, count)} / ${count} players...`));
    }
  }
  
  return allPlayers;
}
```

## Benefits
1. **Complete Player Coverage**: All 22,225 players are now loaded
2. **Better Matching**: Reduces failed player lookups and duplicate creation
3. **Progress Visibility**: Shows loading progress for large datasets
4. **Maintainable**: Uses proper pagination pattern for Supabase

## Verification
Run the collector and confirm it shows:
```
Loading all players from database...
Found 22225 total players, loading in batches...
  Loaded 5000 / 22225 players...
  Loaded 10000 / 22225 players...
  Loaded 15000 / 22225 players...
  Loaded 20000 / 22225 players...
  Loaded 22225 / 22225 players...
✓ Loaded 16208 players
```

## Next Steps
1. Run the collector with the fix to process games with proper player mapping
2. Monitor for any remaining player matching issues
3. Consider adding similar pagination to other queries that might hit the 1,000 record limit