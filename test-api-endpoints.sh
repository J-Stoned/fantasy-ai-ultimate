#!/bin/bash

echo "🧪 TESTING ULTIMATE STATS API V3 ENDPOINTS"
echo "========================================="
echo ""

BASE_URL="http://localhost:3000/api/v3/ultimate-stats"

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    
    echo ""
    echo "📍 Testing: $name"
    echo "   Method: $method"
    echo "   URL: $url"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "   ✅ Status: $http_code"
        # Pretty print first 200 chars of response
        echo "   Response: $(echo "$body" | head -c 200)..."
    else
        echo "   ❌ Status: $http_code"
        echo "   Error: $(echo "$body" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "$body")"
    fi
}

echo "=== MAIN ENDPOINT TESTS ==="

test_endpoint "Get all ultimate stats" "GET" "$BASE_URL?limit=5"
test_endpoint "Filter by NBA" "GET" "$BASE_URL?sport=NBA&limit=3"
test_endpoint "Get live games" "GET" "$BASE_URL?live=true"
test_endpoint "Get specific metrics" "GET" "$BASE_URL?metrics=fantasy_points_estimate,true_shooting_pct&limit=3"
test_endpoint "Test pagination" "GET" "$BASE_URL?limit=5&offset=10"

echo ""
echo "=== PLAYER ENDPOINT TESTS ==="

# Get a sample player ID first
player_id=$(curl -s "$BASE_URL?limit=1" | jq -r '.data[0].player_id // empty' 2>/dev/null)

if [ ! -z "$player_id" ]; then
    test_endpoint "Get player stats" "GET" "$BASE_URL/players/$player_id"
    test_endpoint "Get player last 5 games" "GET" "$BASE_URL/players/$player_id?last_n_games=5"
else
    echo "   ⚠️  No player ID found for testing"
fi

echo ""
echo "=== GAME ENDPOINT TESTS ==="

# Get a sample game ID
game_id=$(curl -s "$BASE_URL?limit=1" | jq -r '.data[0].game_id // empty' 2>/dev/null)

if [ ! -z "$game_id" ]; then
    test_endpoint "Get game stats" "GET" "$BASE_URL/games/$game_id"
    test_endpoint "Get home team only" "GET" "$BASE_URL/games/$game_id?team=home"
    test_endpoint "Refresh game stats" "POST" "$BASE_URL/games/$game_id/refresh" "{}"
else
    echo "   ⚠️  No game ID found for testing"
fi

echo ""
echo "=== POST ENDPOINT TESTS ==="

test_endpoint "Calculate stats (no params)" "POST" "$BASE_URL" "{}"

if [ ! -z "$game_id" ]; then
    test_endpoint "Calculate stats for game" "POST" "$BASE_URL" "{\"game_id\":\"$game_id\"}"
fi

echo ""
echo "=== EDGE CASE TESTS ==="

test_endpoint "Invalid player ID" "GET" "$BASE_URL/players/invalid-id"
test_endpoint "Invalid game ID" "GET" "$BASE_URL/games/invalid-id"
test_endpoint "Excessive limit" "GET" "$BASE_URL?limit=5000"

echo ""
echo "========================================="
echo "✅ API endpoint testing complete!"
echo ""
echo "To run more comprehensive tests:"
echo "  npx tsx scripts/test-ultimate-stats-api.ts"
echo ""
echo "To check if server is running:"
echo "  curl http://localhost:3000/api/v3/ultimate-stats/health || echo 'Server not responding'"
echo ""

# Actually check health now
echo "🏥 Checking API health..."
curl -s http://localhost:3000/api/v3/ultimate-stats/health | jq '.' 2>/dev/null || echo "❌ Server not responding"