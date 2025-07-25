# 🚀 Quick Database Setup for Vercel

## Option 1: Neon (Recommended - 30 seconds)

1. **Sign up at [neon.tech](https://neon.tech)**
   - Use "Sign in with GitHub" for fastest setup

2. **Create Database**
   - Click "Create a project"
   - Name it "fantasy-ai"
   - Region: Choose closest to you
   - Click "Create project"

3. **Copy Connection String**
   - You'll see a connection string like:
   ```
   postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   - Copy this entire string

4. **Add to Vercel**
   - Go to your Vercel project settings
   - Add as both `DATABASE_URL` and `POSTGRES_URL`

## Option 2: Use Existing Local PostgreSQL

If you have PostgreSQL running locally:

1. **Find your password**:
   ```bash
   # If you know the username (often 'postgres'):
   psql -U postgres -c "SELECT 1"
   # It will prompt for password
   ```

2. **Create a database**:
   ```bash
   createdb fantasy_ai_production
   ```

3. **Connection string format**:
   ```
   postgresql://username:password@localhost:5432/fantasy_ai_production
   ```

## Option 3: Supabase (More Features)

1. **Sign up at [supabase.com](https://supabase.com)**
2. **Create new project**
   - Choose a name
   - **SET A DATABASE PASSWORD** (save this!)
   - Choose region
3. **Get connection string**
   - Go to Settings → Database
   - Copy "Connection string" under "Connection Pooling"
   - Replace `[YOUR-PASSWORD]` with your password

## 🎯 After Database Setup

Your Vercel environment variables should look like:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
POSTGRES_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Security (use the generated values from earlier)
JWT_SECRET=a7d4d7567f2376e5d56575c1423e0be72342cacf2942ea291ce8cccfa4b95d87
ENCRYPTION_KEY=1872f0c428e948ddfa515f093756a625289b5734d8515291c610e5c79b13af0d
SESSION_SECRET=eaae515765780c740292b89dc9fea54504e41dd63898ad94000efe868a64f4dc

# Admin
ADMIN_PASSWORD=choose_a_strong_password_here

# URLs
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Need Help?

If you're stuck, the easiest option is:
1. Go to [neon.tech](https://neon.tech)
2. Click "Sign in with GitHub"
3. Create project
4. Copy the connection string they show you
5. Paste it in Vercel

That's it! 🎉