# 🔧 FIX MCP SERVERS - CRITICAL ISSUE FOUND

## 🚨 THE PROBLEM:
Only 3 out of 33 MCP servers are being loaded by Claude Code:
- ✅ elevenlabs (working)
- ✅ fantasy-intelligence (working) 
- ❌ postgres (not loaded)
- ❌ 30 other servers (not loaded)

## 🔍 ROOT CAUSE:
Claude Code is not properly loading all MCP servers from `.mcp.json` even though:
- `enableAllProjectMcpServers: true` is set
- All 33 MCP server processes are running
- The configuration is valid

## 🛠️ FIXES TO TRY:

### Fix 1: Force Reload Claude Code with MCP
```bash
# Completely close Claude Code
# Then restart with debug mode:
claude-code --debug --mcp
```

### Fix 2: Check Claude Code Version
Make sure you have the latest version that supports MCP:
```bash
claude-code --version
```

### Fix 3: Manual MCP Server Registration
Since only some servers are loading, there might be a registration issue. Try:

1. **Close Claude Code completely**
2. **Kill all MCP processes**:
   ```bash
   pkill -f "mcp|modelcontextprotocol"
   ```
3. **Clear any MCP cache**:
   ```bash
   rm -rf ~/.claude/mcp-cache/
   ```
4. **Restart Claude Code**

### Fix 4: Check for MCP Logs
Look for Claude Code logs that might show why servers aren't loading:
```bash
# Check for log files
find ~/.claude -name "*.log" -type f 2>/dev/null

# Or check system logs
journalctl -u claude-code --since "1 hour ago"
```

### Fix 5: Test Individual MCP Server
Try to manually test if postgres MCP works:
```bash
# Set environment variable
export POSTGRES_CONNECTION_STRING="postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres"

# Try to run it
npx -y @modelcontextprotocol/server-postgres
```

## 🎯 IMMEDIATE WORKAROUND:

Since we know the database connection string, we can create a direct database script:
```bash
# Direct database access script
npx tsx scripts/fix-email-confirmation.ts your-email@example.com
```

## 📝 WHAT SHOULD HAPPEN:

When MCP is working correctly:
1. All 33 servers should be accessible
2. You should see tools like:
   - `mcp__postgres__query`
   - `mcp__filesystem__read_file`
   - `mcp__github__create_issue`
   - etc.

## 🚀 NEXT STEPS:

1. **Report this bug** to Claude Code team - MCP servers aren't being fully loaded
2. **Check if there's a config limit** - maybe only N servers can be loaded
3. **Try reducing servers** - temporarily disable some in .mcp.json to test

## 💡 KEY INSIGHT:

The fact that ElevenLabs and fantasy-intelligence ARE working proves:
- MCP functionality is enabled
- Some servers can connect
- The issue is with the loading/discovery mechanism

This is likely a Claude Code bug where it's not loading all configured servers.