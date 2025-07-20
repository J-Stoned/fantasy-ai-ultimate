# Multi-Platform Fantasy League Import System

This comprehensive system allows users to import and manage fantasy leagues from multiple platforms in one unified interface.

## Features

### 1. Platform Import Wizard (`PlatformImportWizard.tsx`)
- **OAuth Support**: ESPN and Yahoo authentication flows
- **API Key Support**: DraftKings and FanDuel integration
- **Credential Support**: Sleeper and CBS Sports login
- **Visual Progress**: Step-by-step import with real-time updates
- **Platform Detection**: Auto-detects connected platforms

### 2. Unified Dashboard (`UnifiedDashboard.tsx`)
- **All Leagues View**: See all imported leagues across platforms
- **Sport Filtering**: Filter by NFL, NBA, MLB, NHL
- **Quick Actions**: One-click sync and refresh
- **Real-time Updates**: Auto-sync every 5 minutes
- **Platform Indicators**: Visual badges for each platform

### 3. Cross-Platform Trade Analyzer (`CrossPlatformTradeAnalyzer.tsx`)
- **Unified Player View**: See same players across different platforms
- **Value Comparison**: Compare player values in different scoring systems
- **Trade Impact**: Analyze trades across all your leagues
- **High Variance Detection**: Alerts for players with different values
- **Multi-League Support**: Apply trades to multiple leagues

### 4. Lineup Optimizer (`LineupOptimizer.tsx`)
- **AI-Powered Optimization**: Uses pattern detection for best lineups
- **Drag & Drop Interface**: Easy lineup management
- **Cross-League Application**: Set optimal lineups across all platforms
- **Pattern Integration**: Shows relevant patterns for each player
- **Real-time Projections**: Live point projections

### 5. Pattern Alerts (`PatternAlerts.tsx`)
- **Real-time Notifications**: Alerts when patterns trigger
- **Actionable Insights**: Clear recommendations for each pattern
- **Confidence Scores**: Shows pattern reliability
- **Historical Accuracy**: Displays past performance
- **Priority Filtering**: Focus on high-impact alerts

## State Management

Uses Zustand with persistence for:
- Platform authentication tokens
- Imported league data
- Cross-platform player mappings
- Import progress tracking
- User preferences

## API Integration

### Supported Platforms:
1. **ESPN Fantasy**
   - OAuth 2.0 authentication
   - Full league and roster data
   - Real-time scoring updates

2. **Yahoo Fantasy**
   - OAuth 2.0 with fantasy sports scope
   - XML/JSON hybrid API
   - Complete league management

3. **Sleeper**
   - Username-based authentication
   - Modern REST API
   - Dynasty league support

4. **CBS Sports**
   - Credential-based login
   - Web scraping fallback
   - Traditional league formats

5. **DraftKings DFS**
   - API key authentication
   - Contest and lineup data
   - GPP and cash game support

6. **FanDuel DFS**
   - API key authentication
   - Contest entries tracking
   - Multi-sport support

## Backend Integration

Seamlessly connects with:
- Pattern Detection APIs (ports 3336-3337)
- PostgreSQL database for player stats
- WebSocket for real-time updates
- ML models for predictions

## Usage

```tsx
import { UnifiedDashboard } from '@/components/leagues/UnifiedDashboard';

// In your page component
export default function LeaguesPage() {
  return <UnifiedDashboard />;
}
```

## Environment Variables

Required for platform integrations:
```env
YAHOO_CLIENT_ID=your_yahoo_client_id
YAHOO_CLIENT_SECRET=your_yahoo_client_secret
ESPN_API_KEY=your_espn_key
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

## Security

- OAuth tokens stored securely
- Credentials encrypted in transit
- Session-based authentication
- CSRF protection on OAuth flows

## Performance

- Lazy loading of league data
- Optimistic UI updates
- Batch API requests
- Local caching with Zustand
- Debounced search and filters