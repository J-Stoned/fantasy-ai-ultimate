# 🔒 SECURE COMMIT GUIDE

## ⚠️ IMPORTANT: Never commit secrets!

### Before committing:
1. **Create .env file** with your actual credentials (never commit this!)
2. **Use .env.example** as a template for others
3. **All scripts now use environment variables** via `scripts/config.ts`

### Setup:
```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit .env with your actual credentials
nano .env

# 3. Scripts will automatically load from .env
```

### Updated .gitignore includes:
- `.mcp.json` (contains API keys)
- `.claude/` directory
- `mcp-test-results.json`
- `*-player-mappings.json`
- All `.env` files except `.env.example`

### Safe to commit:
- Scripts using `config.ts` for credentials
- `.env.example` with placeholder values
- Documentation without secrets

### To run scripts:
```bash
# Scripts now require .env file
npx tsx scripts/mlb-stats-megabatch-processor.ts
```

### If you accidentally committed secrets:
1. Remove from history: `git filter-branch`
2. Rotate all exposed credentials immediately
3. Force push to overwrite history

**Remember**: Once a secret is pushed to GitHub, consider it compromised!