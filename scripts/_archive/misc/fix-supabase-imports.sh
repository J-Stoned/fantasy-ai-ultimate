#!/bin/bash

echo "🔧 Fixing Supabase import paths..."

# Fix all imports in /app directory (3 levels deep)
find apps/web/app -name "*.ts" -o -name "*.tsx" | while read file; do
  if grep -q "from '../../lib/supabase/server'" "$file"; then
    echo "Fixing: $file"
    sed -i "s|from '../../lib/supabase/server'|from '../../../lib/supabase/server'|g" "$file"
  fi
done

# Fix imports that might be 2 levels deep
find apps/web/app -name "*.ts" -o -name "*.tsx" | while read file; do
  if grep -q "from '../lib/supabase/server'" "$file"; then
    echo "Fixing: $file"
    sed -i "s|from '../lib/supabase/server'|from '../../lib/supabase/server'|g" "$file"
  fi
done

echo "✅ Import paths fixed!"