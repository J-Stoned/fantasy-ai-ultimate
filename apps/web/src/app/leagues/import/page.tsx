'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { PlatformImportWizard } from '../../../components/leagues/PlatformImportWizard';
import { LeagueImportService } from '@/lib/services/traditional-fantasy/league-import-service';
import { logger } from '@/lib/logging/logger';

// Loading component for better UX
function ImportSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-64 mb-2"></div>
            <div className="h-4 bg-white/5 rounded w-48"></div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6">
                <div className="animate-pulse">
                  <div className="w-12 h-12 bg-white/10 rounded-lg mb-4"></div>
                  <div className="h-6 bg-white/10 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-white/5 rounded w-full mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-white/5 rounded w-12"></div>
                    <div className="h-6 bg-white/5 rounded w-12"></div>
                    <div className="h-6 bg-white/5 rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeagueImportPage() {
  const [importResult, setImportResult] = useState<any>(null);

  const handleImportComplete = (result: any) => {
    logger.info('🔥 League import completed with ELITE performance data!', {
      leaguesImported: result.leaguesImported,
      dataSource: '1.57M game stats dataset'
    });
    setImportResult(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-8"
      >
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg"
          >
            <h3 className="text-green-400 font-semibold mb-2">🎉 Import Successful!</h3>
            <p className="text-green-200">
              Successfully imported {importResult.leaguesImported} league(s) with real performance data from our 1.57M game stats database!
            </p>
          </motion.div>
        )}
        
        <Suspense fallback={<ImportSkeleton />}>
          <PlatformImportWizard 
            onClose={() => window.history.back()}
            onImportComplete={handleImportComplete}
            importService={new LeagueImportService()}
          />
        </Suspense>
      </motion.div>
    </div>
  );
}