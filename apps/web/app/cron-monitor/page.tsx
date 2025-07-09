'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { createComponentLogger } from '../../lib/utils/client-logger';

const logger = createComponentLogger('CronMonitorPage');

interface JobStatus {
  name: string;
  lastRun: string | null;
  nextRun: string | null;
  isRunning: boolean;
  lastError: string | null;
  successCount: number;
  errorCount: number;
}

export default function CronMonitorPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchJobStatus = async () => {
    try {
      const response = await fetch('/api/cron/status');
      const data = await response.json();
      setJobs(data.jobs);
      setLastUpdate(new Date());
    } catch (error) {
      logger.error('Failed to fetch job status', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobStatus();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchJobStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (job: JobStatus) => {
    if (job.isRunning) return 'bg-blue-100 text-blue-800';
    if (job.lastError) return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (job: JobStatus) => {
    if (job.isRunning) return 'Running';
    if (job.lastError) return 'Error';
    return 'Idle';
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cron Job Monitor</h1>
        <p className="text-gray-600">
          Last updated: {formatDistanceToNow(lastUpdate, { addSuffix: true })}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading job status...</div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <div
              key={job.name}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{job.name}</h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    job
                  )}`}
                >
                  {getStatusText(job)}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Last Run</p>
                  <p className="font-medium">
                    {job.lastRun
                      ? formatDistanceToNow(new Date(job.lastRun), {
                          addSuffix: true,
                        })
                      : 'Never'}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Next Run</p>
                  <p className="font-medium">
                    {job.nextRun
                      ? formatDistanceToNow(new Date(job.nextRun), {
                          addSuffix: true,
                        })
                      : 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Success Count</p>
                  <p className="font-medium text-green-600">
                    {job.successCount}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Error Count</p>
                  <p className="font-medium text-red-600">{job.errorCount}</p>
                </div>
              </div>

              {job.lastError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Last Error: {job.lastError}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="font-semibold mb-2">Cron Jobs Overview</h3>
        <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
          <li>• <strong>Live Scores:</strong> Updates every 30 seconds during games</li>
          <li>• <strong>Player Stats:</strong> Collects every 2 minutes</li>
          <li>• <strong>Injury Reports:</strong> Checks every 30 minutes</li>
          <li>• <strong>News:</strong> Aggregates every 15 minutes</li>
          <li>• <strong>Social Mentions:</strong> Scans every 10 minutes</li>
          <li>• <strong>Daily Cleanup:</strong> Runs at 3 AM</li>
          <li>• <strong>Weekly Aggregation:</strong> Mondays at 2 AM</li>
        </ul>
      </div>
    </div>
  );
}