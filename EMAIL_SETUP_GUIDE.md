# 📧 EMAIL CONFIRMATION SETUP GUIDE

## Current Issue: Email Confirmations Disabled

The signup process works but email confirmations are currently **disabled** in `supabase/config.toml` (line 161).

## 🚀 QUICK FIX FOR LOCAL DEVELOPMENT:

### Option 1: Access Local Email Testing (Inbucket)
Since you're running locally, Supabase captures all emails in a test interface:

1. **Access Inbucket Email Interface**:
   ```
   http://localhost:54324
   ```
   
2. **Find Your Email**:
   - Look for emails sent to your signup address
   - Click to view the confirmation link
   - Copy the confirmation link and open it

### Option 2: Skip Email Confirmation (Fastest)
1. Go to Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/pvekvqiqrrpugfmpgaup/auth/users
   ```

2. Find your user and manually confirm them

3. Or use SQL in Supabase SQL Editor:
   ```sql
   UPDATE auth.users 
   SET email_confirmed_at = now() 
   WHERE email = 'your-email@example.com';
   ```

## 🏭 PRODUCTION EMAIL SETUP:

### 1. Enable Email Confirmations
Edit `supabase/config.toml`:
```toml
# Change this line:
enable_confirmations = true  # was false
```

### 2. Configure SMTP (Production)
Uncomment and configure in `supabase/config.toml`:
```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"  # or smtp.resend.com
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"
admin_email = "support@fantasy-ai.com"
sender_name = "Fantasy AI"
```

### 3. Add Email Service API Key
Add to `.env.local`:
```bash
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# Or Resend (recommended)
RESEND_API_KEY=your-resend-api-key
```

### 4. Configure in Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/pvekvqiqrrpugfmpgaup/settings/auth
2. Scroll to "SMTP Settings"
3. Enable "Custom SMTP"
4. Enter your SMTP details

## 📨 RECOMMENDED EMAIL SERVICES:

### 1. **Resend** (Best for Startups)
- Free tier: 3,000 emails/month
- Great developer experience
- Sign up: https://resend.com

### 2. **SendGrid** (Most Popular)
- Free tier: 100 emails/day
- Industry standard
- Sign up: https://sendgrid.com

### 3. **Postmark** (Best Deliverability)
- Transactional email specialist
- 100 free test emails
- Sign up: https://postmarkapp.com

## 🎨 CUSTOM EMAIL TEMPLATES:

Create branded confirmation emails:

1. Create template file:
```bash
mkdir -p supabase/templates
touch supabase/templates/confirmation.html
```

2. Add to `supabase/config.toml`:
```toml
[auth.email.template.confirmation]
subject = "Welcome to Fantasy AI - Confirm Your Email"
content_path = "./supabase/templates/confirmation.html"
```

3. Template example:
```html
<h2>Welcome to Fantasy AI! 🚀</h2>
<p>Click below to confirm your email and start dominating fantasy sports:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>With 65.2% pattern accuracy, you're about to change the game!</p>
```

## 🔧 IMMEDIATE WORKAROUND:

For now, you can:
1. Check http://localhost:54324 for the email
2. Or disable email confirmation temporarily by signing in with this test account:
   - Email: demo@fantasy-ai.com
   - Password: FantasyAI2025!

## 🚀 QUICK COMMAND:

To manually confirm your user:
```bash
# Run this in Supabase SQL Editor
UPDATE auth.users 
SET email_confirmed_at = now(), 
    confirmed_at = now() 
WHERE email = 'your-email@example.com';
```

---

**Note**: For production launch, proper email configuration is CRITICAL for user trust and deliverability!