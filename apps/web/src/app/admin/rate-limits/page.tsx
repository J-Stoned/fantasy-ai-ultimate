/**
 * 🛡️ RATE LIMITS ADMIN PAGE 🛡️
 * Monitor and manage API rate limiting
 */

import { Metadata } from 'next';
import { RateLimitMonitor } from '@/components/admin/RateLimitMonitor';

export const metadata: Metadata = {
  title: 'Rate Limits | Admin Dashboard',
  description: 'Monitor API rate limits and DDoS protection',
};

export default function RateLimitsPage() {
  return (
    <div className="container mx-auto p-6">
      <RateLimitMonitor />
    </div>
  );
}