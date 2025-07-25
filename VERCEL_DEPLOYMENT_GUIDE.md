# 🚀 VERCEL DEPLOYMENT GUIDE

## Quick Deploy Steps

### 1. **Prepare for Deployment**
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login
```

### 2. **Connect GitHub Repository**
1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repository
4. Choose the `apps/web` directory as root

### 3. **Configure Build Settings**
In Vercel dashboard, set:
- **Framework Preset**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 4. **Environment Variables**
Add these in Vercel dashboard:

```env
# Database (Required)
DATABASE_URL=your_postgres_connection_string
POSTGRES_URL=your_postgres_connection_string

# Auth & Security (Required)
JWT_SECRET=generate_32_char_secret_here
ENCRYPTION_KEY=generate_32_char_key_here
SESSION_SECRET=generate_32_char_secret_here
ADMIN_PASSWORD=your_secure_admin_password

# App URLs
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://your-app.vercel.app/api
NEXT_PUBLIC_WS_URL=wss://your-app.vercel.app

# Optional Services
REDIS_URL=your_redis_url_or_leave_empty
OPENAI_API_KEY=your_openai_key_or_leave_empty
ELEVENLABS_API_KEY=your_elevenlabs_key_or_leave_empty

# Feature Flags
NEXT_PUBLIC_ENABLE_ML=false
NEXT_PUBLIC_ENABLE_VOICE=false
```

### 5. **Deploy**
```bash
# Deploy to production
vercel --prod

# Or use GitHub integration for auto-deploy
```

## 🔧 Common Issues & Solutions

### TensorFlow Build Errors
The app uses mock ML predictions in production by default. TensorFlow is optional.

### Missing Dependencies
```bash
npm install react-icons @heroicons/react
```

### Database Connection
1. Use a cloud PostgreSQL provider (Neon, Supabase, etc.)
2. Ensure SSL is enabled in connection string
3. Add `?sslmode=require` to DATABASE_URL if needed

### Build Timeouts
If build times out:
1. Increase function timeout in vercel.json
2. Disable source maps in production
3. Use `NEXT_TELEMETRY_DISABLED=1`

## 🎯 Post-Deployment Checklist

- [ ] Test health endpoint: `https://your-app.vercel.app/api/health`
- [ ] Verify database connection
- [ ] Check authentication flow
- [ ] Test key features:
  - [ ] Player search
  - [ ] League management
  - [ ] DFS optimization
  - [ ] User dashboard

## 📊 Monitoring

1. **Vercel Analytics**: Automatically included
2. **Error Tracking**: Check function logs in Vercel dashboard
3. **Performance**: Monitor Core Web Vitals

## 🚀 Production Optimizations

### Edge Functions
For global low latency, add to API routes:
```typescript
export const config = {
  runtime: 'edge',
};
```

### Caching Headers
Already configured in vercel.json for optimal caching.

### Database Pooling
Use connection pooling with your database provider for better performance.

## 🆘 Support

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **GitHub Issues**: Report bugs in your repository

---

**Ready to deploy!** 🎉 Your Fantasy AI Platform will be live in minutes.