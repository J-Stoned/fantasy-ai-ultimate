# 🚀 Supabase Database Quick Start

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and click "New project"
3. Name it: `fantasy-ai-ultimate`
4. **SAVE YOUR DATABASE PASSWORD!**
5. Choose region closest to you
6. Wait ~2 minutes for creation

## Step 2: Get Your Credentials

In Supabase Dashboard:

### API Settings (Settings → API)
- **Project URL**: `https://YOUR_PROJECT_REF.supabase.co`
- **Anon Key**: `eyJ...` (long string)
- **Service Role Key**: `eyJ...` (different long string)

### Database Settings (Settings → Database)
- Click "Connection string" → "Nodejs"
- Copy the string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)

## Step 3: Update .env.local

```bash
# Copy example file
cp .env.local.example .env.local

# Edit .env.local and add your credentials:
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

## Step 4: Run Database Migrations

### Option A: Use Supabase SQL Editor (Easiest)
1. Go to SQL Editor in Supabase dashboard
2. Click "New query"
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click "Run"
5. Repeat for `002_additional_data_tables.sql`
6. Repeat for `supabase/seed.sql`

### Option B: Use MCP in Claude Code
Once you've set DATABASE_URL in .env.local, Claude Code can run the migrations directly!

## Step 5: Test Connection

```bash
# Test database connection
npm run test:db
```

You should see:
- ✅ Prisma connected successfully!
- ✅ Supabase connected successfully!

## Step 6: Generate Prisma Client

```bash
npx prisma generate
```

## Step 7: Start the App!

```bash
npx nx dev web
```

Visit http://localhost:3000 and you're ready to go!

## 🎯 What You Get

- **60+ tables** ready for EVERY player from EVERY league
- **Authentication** with email/social login
- **Real-time** subscriptions
- **Row Level Security** for data protection
- **One-click imports** from all fantasy platforms

## 🚨 Common Issues

**"Connection refused"**
- Check DATABASE_URL has correct password
- URL-encode special characters in password

**"Relation does not exist"**
- Run migrations in order (001, then 002, then seed)

**"Invalid API key"**
- Use the `anon` key, not `service_role` for NEXT_PUBLIC_SUPABASE_ANON_KEY

## 🎉 Success!

Once connected, you can:
- Create accounts
- Import leagues from Yahoo/ESPN/etc
- Browse 2.5M+ players
- Get AI-powered insights

The database is ready to collect and store data for EVERY player from EVERY league!