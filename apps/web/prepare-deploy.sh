#!/bin/bash

echo "🚀 Preparing for Vercel deployment..."

# Clean up previous attempts
rm -rf components lib 2>/dev/null

# Copy components from src
if [ -d "src/components" ]; then
  echo "📁 Copying components..."
  cp -r src/components .
fi

# Copy lib from parent directory
if [ -d "../../lib" ]; then
  echo "📁 Copying lib directory..."
  cp -r ../../lib .
fi

# Create missing files that are imported
echo "📝 Creating stub files for missing imports..."
mkdir -p lib/utils lib/ar lib/supabase

# Create minimal stub implementations
cat > lib/utils/client-logger.ts << 'EOF'
export const log = console.log;
export const error = console.error;
export const warn = console.warn;
export const info = console.info;
export const clientLogger = { log, error, warn, info };
EOF

cat > lib/ar/ARStatsOverlay-client.tsx << 'EOF'
export default function ARStatsOverlay() {
  return <div>AR Stats Overlay - Coming Soon</div>;
}
EOF

cat > lib/supabase/client-browser.ts << 'EOF'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
EOF

# Update package.json to include SSR dependency
echo "📦 Updating package.json..."
npx json -I -f package.json -e 'this.dependencies["@supabase/ssr"]="^0.0.10"'

# Create a minimal deployment vercel.json
cat > vercel.json << 'EOF'
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key",
    "YAHOO_CLIENT_ID": "@yahoo-client-id",
    "YAHOO_CLIENT_SECRET": "@yahoo-client-secret",
    "YAHOO_REDIRECT_URI": "@yahoo-redirect-uri"
  }
}
EOF

echo "✅ Deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run: vercel --prod"
echo "2. When prompted, link to existing project"
echo "3. Add these secrets in Vercel dashboard:"
echo "   - supabase-url"
echo "   - supabase-anon-key"
echo "   - supabase-service-role-key"
echo "   - yahoo-client-id"
echo "   - yahoo-client-secret"
echo "   - yahoo-redirect-uri"