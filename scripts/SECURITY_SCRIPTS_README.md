# Supabase Security Scripts Documentation

This directory contains comprehensive security scripts for auditing and securing your Supabase database using both the REST API and Management API.

## Available Scripts

### 1. Quick RLS Status Check
```bash
npm run security:rls:check
```
- **Purpose**: Rapidly checks RLS status on all tables
- **Runtime**: ~2-3 seconds
- **Output**: Color-coded list of secured/exposed tables
- **Use when**: You need a quick security overview

### 2. Comprehensive Security Audit
```bash
npm run security:audit
```
- **Purpose**: Full security audit using Supabase REST API
- **Runtime**: ~10-15 seconds
- **Output**: 
  - JSON report with detailed findings
  - Markdown report for easy reading
  - SQL script to fix issues
- **Use when**: Performing regular security audits

### 3. Management API Security Audit
```bash
npm run security:management
```
- **Purpose**: Advanced security audit using Supabase Management API
- **Requirements**: `SUPABASE_MANAGEMENT_API_TOKEN` environment variable
- **Features**:
  - Checks database roles and permissions
  - Audits authentication settings
  - Reviews network restrictions
  - Can apply some fixes automatically
- **Use when**: You need deep security analysis

### 4. Enable RLS on All Tables
```bash
npm run security:rls:enable
```
- **Purpose**: Shows the SQL script location to enable RLS
- **Action**: Copy `scripts/enable-comprehensive-rls.sql` to Supabase SQL Editor

### 5. Monitor Security Status
```bash
npm run security:monitor
```
- **Purpose**: Checks if your data is exposed via public API
- **Output**: List of exposed tables and row counts
- **Use when**: Verifying security after changes

## Setup Requirements

### Environment Variables

Create a `.env.local` file with:

```env
# Required for basic checks
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for advanced operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for Management API (optional)
SUPABASE_MANAGEMENT_API_TOKEN=your-management-api-token
```

### Getting a Management API Token

1. Go to https://app.supabase.com/account/tokens
2. Click "Generate new token"
3. Give it a descriptive name (e.g., "Security Audit")
4. Select appropriate permissions
5. Copy the token and add to `.env.local`

## Security Best Practices

### 1. Enable RLS on ALL Tables

```sql
-- Run this for each table
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
```

### 2. Create Appropriate Policies

#### For Public Data (read-only):
```sql
CREATE POLICY "Public read access" ON public.players
  FOR SELECT TO authenticated USING (true);
```

#### For User-Specific Data:
```sql
CREATE POLICY "Users can view own data" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

#### For Sensitive Data:
```sql
CREATE POLICY "No public access" ON public.player_contracts
  FOR SELECT TO authenticated USING (false);
```

### 3. Regular Security Audits

Set up a monthly cron job:
```bash
# Add to your CI/CD pipeline
0 0 1 * * npm run security:audit
```

### 4. Monitor Access Logs

Regularly check Supabase dashboard:
- Database → Logs → Auth logs
- Look for suspicious patterns
- Monitor failed authentication attempts

## Common Issues and Solutions

### Issue: "Tables are exposed"
**Solution**: Run the RLS enablement script immediately
```bash
# Copy and run in SQL Editor
scripts/enable-comprehensive-rls.sql
```

### Issue: "RLS enabled but no policies"
**Solution**: Table is locked (no access). Add appropriate policies:
```sql
-- Example for public read access
CREATE POLICY "table_name_read" ON public.table_name
  FOR SELECT TO authenticated USING (true);
```

### Issue: "Cannot execute SQL via API"
**Solution**: Use Supabase SQL Editor directly or ensure service role key has proper permissions

### Issue: "Management API returns 401"
**Solution**: 
1. Check token is valid
2. Ensure token has required permissions
3. Verify project reference is correct

## Security Checklist

- [ ] All tables have RLS enabled
- [ ] Each table has appropriate policies
- [ ] Service role keys are never exposed client-side
- [ ] API keys are stored securely
- [ ] Network restrictions are configured (Pro plan)
- [ ] 2FA is enabled on all team accounts
- [ ] Regular security audits are scheduled
- [ ] Database backups are enabled
- [ ] SSL/TLS is enforced
- [ ] CAPTCHA is enabled for auth

## Emergency Response

If you discover exposed data:

1. **Immediately enable RLS**:
   ```bash
   npm run security:rls:check
   # Copy the quick fix commands to SQL Editor
   ```

2. **Check access logs**:
   - Go to Supabase Dashboard → Database → Logs
   - Look for unauthorized access

3. **Rotate credentials if compromised**:
   - Database password
   - API keys (if possible)

4. **Audit and update policies**:
   ```bash
   npm run security:audit
   ```

5. **Monitor for suspicious activity**:
   ```bash
   npm run security:monitor
   ```

## Integration with CI/CD

Add to your GitHub Actions:

```yaml
- name: Security Check
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  run: |
    npm run security:rls:check
    npm run security:verify
```

## Support

For issues or questions:
1. Check Supabase documentation
2. Review security best practices
3. Contact Supabase support for critical issues