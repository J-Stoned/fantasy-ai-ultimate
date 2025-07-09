#!/bin/bash

echo "🔧 Fixing import paths..."

# Fix all relative imports from ../../../../lib to ../../lib
find app -name "*.tsx" -o -name "*.ts" | while read file; do
  if grep -q "../../../../lib" "$file"; then
    echo "Fixing imports in: $file"
    sed -i 's|../../../../lib|../../lib|g' "$file"
  fi
done

# Fix imports from ../../../lib to ../lib
find app -name "*.tsx" -o -name "*.ts" | while read file; do
  if grep -q "../../../lib" "$file"; then
    echo "Fixing imports in: $file"
    sed -i 's|../../../lib|../lib|g' "$file"
  fi
done

# Fix imports from ../../components to ../components or ./components
find app -name "*.tsx" -o -name "*.ts" | while read file; do
  if grep -q "../../components" "$file"; then
    echo "Fixing component imports in: $file"
    sed -i 's|../../components|../components|g' "$file"
  fi
done

# Add missing dependencies to package.json
echo "📦 Adding missing dependencies..."
npm install --save react-dnd react-dnd-html5-backend

echo "✅ Import paths fixed!"