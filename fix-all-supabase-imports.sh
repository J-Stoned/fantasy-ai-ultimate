#!/bin/bash

# Fix all remaining supabase import paths

echo "Fixing remaining Supabase import paths..."

# Files in apps/web/app/api/auth/yahoo/route.ts (4 levels deep)
find apps/web/app/api/auth -name "*.ts" -exec sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../../lib/supabase/server'|g" {} \;

# Files in apps/web/app/api/contests/route.ts (3 levels deep)
sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../lib/supabase/server'|g" apps/web/app/api/contests/route.ts

# Files in apps/web/app/api/import/**/route.ts (4 levels deep)
find apps/web/app/api/import -name "*.ts" -exec sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../../lib/supabase/server'|g" {} \;

# Files in apps/web/app/api/patterns/route.ts (3 levels deep)
sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../lib/supabase/server'|g" apps/web/app/api/patterns/route.ts

# Files in apps/web/app/api/platform-connections/**/route.ts (4 levels deep)
find apps/web/app/api/platform-connections -name "*.ts" -exec sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../../lib/supabase/server'|g" {} \;

# Files in apps/web/app/api/players/route.ts (3 levels deep)
sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../lib/supabase/server'|g" apps/web/app/api/players/route.ts

# Files in apps/web/app/api/stripe/**/route.ts (4 levels deep)
find apps/web/app/api/stripe -name "*.ts" -exec sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../../lib/supabase/server'|g" {} \;

# Files in apps/web/app/auth/**/route.ts (3 levels deep)
find apps/web/app/auth -name "*.ts" -exec sed -i "s|from '\.\./\.\./\.\./lib/supabase/server'|from '../../../lib/supabase/server'|g" {} \;

# Also fix any files that might have the wrong 2-level or 5-level paths
find apps/web -name "*.ts" -o -name "*.tsx" | xargs sed -i "s|from '\.\./\.\./\.\./\.\./lib/supabase/server'|from '../../../../lib/supabase/server'|g"
find apps/web -name "*.ts" -o -name "*.tsx" | xargs sed -i "s|from '\.\./\.\./\.\./\.\./\.\./lib/supabase/server'|from '../../../../../lib/supabase/server'|g"

echo "Fixed all Supabase import paths!"

# Show what was fixed
echo -e "\nFixed files:"
find apps/web -name "*.ts" -o -name "*.tsx" | xargs grep -l "lib/supabase/server" | sort | uniq