#!/bin/bash

echo "🔒 Setting up Marcus Security Git Hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Marcus Security Check: Scanning for exposed secrets..."

# Patterns to check for
PATTERNS=(
    # API Keys
    "sk-[A-Za-z0-9]{48}"  # OpenAI
    "sk-ant-[A-Za-z0-9-_]{90,}"  # Anthropic
    "eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+"  # JWT tokens
    "IL36Z9I7tV2629Lr"  # Known exposed password
    
    # Generic patterns
    "password.*=.*['\"][^'\"]{8,}"
    "secret.*=.*['\"][^'\"]{8,}"
    "token.*=.*['\"][^'\"]{8,}"
    
    # Service-specific
    "postgres:\/\/[^:]+:[^@]+@"  # Database URLs with passwords
    "sk_test_[A-Za-z0-9]{24,}"  # Stripe test keys
    "sk_live_[A-Za-z0-9]{24,}"  # Stripe live keys
)

# Check staged files
FOUND_SECRETS=0
for pattern in "${PATTERNS[@]}"; do
    if git diff --cached --name-only | xargs grep -E "$pattern" 2>/dev/null; then
        echo "❌ ERROR: Found potential secret matching pattern: $pattern"
        FOUND_SECRETS=1
    fi
done

# Check for .env files
if git diff --cached --name-only | grep -E "^\.env($|\.)" | grep -v "\.example$"; then
    echo "❌ ERROR: Attempting to commit .env file!"
    FOUND_SECRETS=1
fi

if [ $FOUND_SECRETS -eq 1 ]; then
    echo ""
    echo "🚨 COMMIT BLOCKED: Potential secrets detected!"
    echo ""
    echo "To fix:"
    echo "1. Remove the secrets from your staged files"
    echo "2. Use environment variables instead"
    echo "3. Add sensitive files to .gitignore"
    echo ""
    echo "If this is a false positive, use: git commit --no-verify"
    exit 1
fi

echo "✅ No secrets detected. Proceeding with commit..."
EOF

# Make hook executable
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will now:"
echo "- Block commits containing API keys"
echo "- Block commits containing passwords"
echo "- Block commits of .env files"
echo ""
echo "To bypass in emergencies: git commit --no-verify"