'use client';

import { LiveScores } from '@/components/LiveScores';

export default function LiveTestPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>🔥 LIVE NFL SCORES TEST</h1>
      <p>This should show REAL NFL data:</p>
      <LiveScores />
    </div>
  );
}