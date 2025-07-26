# 🔥 API Integration Setup Guide

## Quick Start

### 1. Environment Setup

Copy the environment variables from `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### 2. Get API Keys

#### Firebase Cloud Messaging (Free)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Go to Project Settings > Cloud Messaging
4. Enable Cloud Messaging API
5. Generate Web Push certificate (VAPID key)
6. Download service account JSON

#### Google Analytics 4 (Free)
1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property
3. Set up Web data stream
4. Copy Measurement ID (G-XXXXXXXXXX)

#### Cloudflare CDN (Free)
1. Sign up at [Cloudflare](https://cloudflare.com/)
2. Add your domain
3. Update nameservers at your registrar
4. Go to My Profile > API Tokens
5. Create token with Zone:Read and Zone:Cache Purge
6. Copy Zone ID from domain overview

#### YouTube Data API (Free)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create credentials (API Key)
4. Restrict key to YouTube Data API

#### Google Gemini AI (Free)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Enable Gemini API

### 3. Database Setup

Run the migration script to create necessary tables:

```bash
# Connect to your database and run:
psql -U postgres -d fantasy_ai_local -f scripts/migrations/create-api-integration-tables.sql

# Or if using Supabase, run in SQL Editor
```

### 4. Initialize Services

Add the API Services Provider to your app:

```tsx
// apps/web/src/app/layout.tsx
import { APIServicesProvider } from '@/components/providers/APIServicesProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <APIServicesProvider>
          {children}
        </APIServicesProvider>
      </body>
    </html>
  );
}
```

### 5. Deploy CDN Configuration

```bash
# Deploy Cloudflare edge workers and settings
npm run deploy:cdn
```

### 6. Test Everything

```bash
# Run integration tests
npm run test:integrations
```

## Usage Examples

### Push Notifications
```typescript
import { fcmService } from '@/lib/services/notifications/fcm-service';

// Request permission
const permission = await fcmService.requestPermission();

// Send notification to user
await fcmService.sendToUser(userId, {
  type: NotificationType.PLAYER_NEWS,
  priority: NotificationPriority.HIGH,
  title: 'Breaking News',
  body: 'Player X is injured!'
});
```

### Analytics Tracking
```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

const analytics = useAnalytics();

// Track custom event
analytics.trackEvent('lineup_created', {
  sport: 'nfl',
  platform: 'draftkings'
});

// Track purchase
analytics.trackPurchase({
  transactionId: 'tx_123',
  value: 19.99,
  items: [{ id: 'pro_plan', name: 'Pro Plan' }]
});
```

### CDN Image Optimization
```typescript
import { useCDN } from '@/hooks/useCDN';

const cdn = useCDN();

// Optimize image
const optimizedUrl = cdn.getOptimizedImage('/player.jpg', {
  width: 300,
  format: 'webp',
  quality: 85
});

// Use responsive image
const heroImage = cdn.getResponsiveImage('/hero.jpg', 'large');
```

### AI Chat
```typescript
import { geminiService } from '@/lib/services/ai/gemini-service';

// Chat with AI
const { response } = await geminiService.chat(
  userId,
  'Who should I start at QB this week?'
);

// Get lineup advice
const advice = await geminiService.getLineupAdvice(
  'Should I play the chalk or be contrarian?',
  { sport: 'nfl', contestType: 'gpp' }
);
```

### YouTube Intelligence
```typescript
import { youtubeService } from '@/lib/services/youtube/enhanced-youtube-service';

// Search for player videos
const videos = await youtubeService.getPlayerVideos('Patrick Mahomes');

// Get trending fantasy content
const trending = await youtubeService.getTrendingVideos('nfl', 10);
```

## Monitoring

### Check Service Health
```typescript
import { unifiedAPIService } from '@/lib/services/api/unified-api-service';

const health = unifiedAPIService.getServiceHealth();
health.forEach(service => {
  console.log(`${service.service}: ${service.status}`);
});
```

### CDN Performance Widget
```tsx
import { CDNPerformanceWidget } from '@/components/cdn/CDNPerformanceWidget';

// Add to admin dashboard
<CDNPerformanceWidget />
```

## Troubleshooting

### Common Issues

1. **Firebase notifications not working**
   - Check if service worker is registered
   - Verify VAPID key is correct
   - Ensure HTTPS is enabled

2. **CDN not caching**
   - Verify Cloudflare DNS is active
   - Check cache rules in dashboard
   - Test with `curl -I` to see headers

3. **Gemini AI errors**
   - Check API key is valid
   - Verify quota hasn't been exceeded
   - Try using different model (FLASH vs PRO)

4. **YouTube API quota exceeded**
   - Implement caching
   - Reduce search frequency
   - Apply for quota increase

### Debug Mode

Add to your app to see service status:

```tsx
import { APIServicesStatus } from '@/components/providers/APIServicesProvider';

// Shows status widget in development
<APIServicesStatus />
```

## Production Checklist

- [ ] All environment variables set
- [ ] Database tables created
- [ ] Service worker deployed
- [ ] CDN configured and tested
- [ ] Analytics tracking verified
- [ ] Error handling implemented
- [ ] Rate limiting configured
- [ ] Monitoring dashboards set up

## Support

For issues or questions:
1. Check the troubleshooting section
2. Run `npm run test:integrations` to verify setup
3. Check service health dashboards
4. Review error logs in production