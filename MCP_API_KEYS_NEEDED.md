# MCP API Keys Status

## ✅ Working API Keys (Already Configured):
1. **ElevenLabs**: ✅ sk_521f4dc3f318855f04671a91c76718646ddf4edf71e6055f
2. **OpenAI**: ✅ sk-proj-mIaN5i3rrvdpb6E36DFcEK1xwWRyAzfH...
3. **Supabase**: ✅ Service role key configured
4. **BallDontLie**: ✅ 59de4292-dfc4-4a8a-b337-1e804f4109c6
5. **Database**: ✅ PostgreSQL connection string
6. **Sentry DSN**: ✅ https://9f8d6...@o4509566691770368.ingest.us.sentry.io/...

## ❌ API Keys Needed:

### 1. Slack Bot Token
- **Current**: `xoxb-your-slack-bot-token` (placeholder)
- **How to get**: 
  1. Go to https://api.slack.com/apps
  2. Create new app or select existing
  3. Go to "OAuth & Permissions"
  4. Copy the "Bot User OAuth Token"
- **Format**: Starts with `xoxb-`

### 2. Discord Bot Token
- **Current**: `your-discord-bot-token` (placeholder)
- **How to get**:
  1. Go to https://discord.com/developers/applications
  2. Create new application or select existing
  3. Go to "Bot" section
  4. Copy the token
- **Format**: Long alphanumeric string

### 3. Sentry Auth Token
- **Current**: `sntrys_your-auth-token` (placeholder)
- **How to get**:
  1. Go to https://sentry.io/settings/account/api/auth-tokens/
  2. Create new auth token
  3. Give it project:read scope minimum
- **Format**: Starts with `sntrys_`

## 🔧 Optional Services (Work without keys):
- **Prometheus**: Uses local URL (http://localhost:9090)
- **Redis**: Uses local URL (redis://localhost:6379)
- **MLB API**: No authentication required
- **Most UI/Dev tools**: Work without configuration

## 📝 To Update Keys:
Edit the `/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/.mcp.json` file and replace the placeholder values.