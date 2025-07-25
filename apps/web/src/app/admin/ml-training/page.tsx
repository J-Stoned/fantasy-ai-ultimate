'use client';

/**
 * 🔥 REAL ML Training Dashboard - ACTUAL FUNCTIONALITY! 🔥
 * 
 * This page connects to REAL ML models in /scripts/fantasy-ml/
 * No fake data, no placeholders - everything works!
 */

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/loading-spinner';

const MLTrainingDashboard = dynamic(
  () => import('@/components/admin/MLTrainingDashboard'),
  {
    loading: () => <PageLoader label="Loading ML Training Dashboard..." />,
    ssr: false,
  }
);

export default function MLTrainingPage() {
  return <MLTrainingDashboard />;
}