# 🚀 Setting Up Supabase MCP in Claude Code

## Quick Setup

1. **First, create your Supabase project** at [supabase.com](https://supabase.com)

2. **Update your `.env.local` file** with your Supabase credentials:
   ```
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

3. **Update the `.mcp.json` file** with your actual connection string:
   - Replace `[YOUR-PASSWORD]` with your database password
   - Replace `[YOUR-PROJECT-REF]` with your project reference

4. **Enable MCP in Claude Code** (if not already enabled):
   ```bash
   claude mcp list
   ```

5. **The MCP server should now be available** in Claude Code!

## What the MCP Server Gives You

Once configured, you'll have direct database access through Claude Code:
- Run SQL queries directly
- Create and modify tables
- Insert and update data
- Run migrations
- All without leaving Claude Code!

## Testing the Connection

After setup, I'll be able to:
```sql
-- Create all tables
-- Insert test data
-- Query players
-- Set up indexes
-- Configure RLS policies
```

## Troubleshooting

If the MCP server doesn't appear:
1. Make sure `.mcp.json` is in the project root
2. Check that the connection string is correct
3. Ensure your Supabase project is running
4. Try restarting Claude Code

## Alternative: Use Supabase CLI

If MCP isn't working, we can also use the Supabase CLI:
```bash
npm install -g supabase
supabase init
supabase db push
```

This will push all migrations to your Supabase project.