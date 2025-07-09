#!/bin/bash

echo "🚀 Deploying Fantasy AI to Vercel..."

# 1. First, let's create a standalone deployment
echo "Creating standalone deployment package..."

# 2. Copy necessary files
cp -r src .vercel-deploy/
cp -r app .vercel-deploy/
cp -r public .vercel-deploy/
cp package.json .vercel-deploy/
cp next.config.js .vercel-deploy/
cp tsconfig.json .vercel-deploy/
cp tailwind.config.ts .vercel-deploy/
cp postcss.config.js .vercel-deploy/

# 3. Create a deployment-ready package.json
cat > .vercel-deploy/package.json << 'EOF'
{
  "name": "fantasy-ai-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@supabase/supabase-js": "^2.39.3",
    "@supabase/auth-helpers-nextjs": "^0.8.7",
    "axios": "^1.6.5",
    "clsx": "^2.1.0",
    "lucide-react": "^0.312.0",
    "socket.io-client": "^4.7.4",
    "tailwind-merge": "^2.2.0",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33"
  },
  "devDependencies": {
    "typescript": "5.3.3",
    "@types/react": "18.3.23",
    "@types/react-dom": "18.3.7",
    "@types/node": "20.11.5"
  }
}
EOF

echo "Package ready for deployment!"
echo ""
echo "📝 Next steps:"
echo "1. cd .vercel-deploy"
echo "2. vercel --prod"
echo "3. After deployment, add environment variables in Vercel dashboard:"
echo "   - NEXT_PUBLIC_SUPABASE_URL"
echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - YAHOO_CLIENT_ID"
echo "   - YAHOO_CLIENT_SECRET"
echo "   - YAHOO_REDIRECT_URI (use your-app.vercel.app URL)"
echo ""
echo "4. Redeploy after adding environment variables"