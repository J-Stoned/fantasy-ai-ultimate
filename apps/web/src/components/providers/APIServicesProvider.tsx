'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import Script from 'next/script';
import { fcmService } from '@/lib/services/notifications/fcm-service';
import { ga4Service } from '@/lib/analytics/ga4-service';
import { initializeCDN, runCDNDiagnostics } from '@/lib/services/cdn/initialize-cdn';
import { unifiedAPIService } from '@/lib/services/api/unified-api-service';
import { logger } from '@/lib/logging/logger';
import { supabase } from '@/lib/supabase/client';

interface ServicesStatus {
  firebase: 'pending' | 'initialized' | 'error';
  analytics: 'pending' | 'initialized' | 'error';
  cdn: 'pending' | 'initialized' | 'error' | 'not-required';
  unified: 'pending' | 'initialized' | 'error';
}

interface APIServicesContextType {
  status: ServicesStatus;
  isReady: boolean;
  error?: string;
}

const APIServicesContext = createContext<APIServicesContextType>({
  status: {
    firebase: 'pending',
    analytics: 'pending',
    cdn: 'pending',
    unified: 'pending'
  },
  isReady: false
});

export const useAPIServices = () => useContext(APIServicesContext);

interface APIServicesProviderProps {
  children: ReactNode;
}

export function APIServicesProvider({ children }: APIServicesProviderProps) {
  const user = useUser();
  const [status, setStatus] = useState<ServicesStatus>({
    firebase: 'pending',
    analytics: 'pending',
    cdn: 'pending',
    unified: 'pending'
  });
  const [error, setError] = useState<string>();
  const [isReady, setIsReady] = useState(false);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // 1. Initialize Firebase Cloud Messaging
        try {
          await fcmService.initialize();
          setStatus(prev => ({ ...prev, firebase: 'initialized' }));
          logger.info('Firebase Cloud Messaging initialized');
        } catch (err) {
          logger.error('Failed to initialize Firebase:', err);
          setStatus(prev => ({ ...prev, firebase: 'error' }));
        }

        // 2. Initialize Google Analytics
        try {
          ga4Service.initialize();
          setStatus(prev => ({ ...prev, analytics: 'initialized' }));
          logger.info('Google Analytics 4 initialized');
        } catch (err) {
          logger.error('Failed to initialize GA4:', err);
          setStatus(prev => ({ ...prev, analytics: 'error' }));
        }

        // 3. Initialize CDN (admin only)
        if (user && process.env.NODE_ENV === 'production') {
          try {
            // Check if user is admin
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role')
              .eq('user_id', user.id)
              .single();

            if (profile?.role === 'admin') {
              const cdnResult = await initializeCDN();
              if (cdnResult.success) {
                setStatus(prev => ({ ...prev, cdn: 'initialized' }));
                logger.info('Cloudflare CDN initialized');
              } else {
                setStatus(prev => ({ ...prev, cdn: 'error' }));
              }
            } else {
              setStatus(prev => ({ ...prev, cdn: 'not-required' }));
            }
          } catch (err) {
            logger.error('Failed to initialize CDN:', err);
            setStatus(prev => ({ ...prev, cdn: 'error' }));
          }
        } else {
          setStatus(prev => ({ ...prev, cdn: 'not-required' }));
        }

        // 4. Mark unified API as ready
        setStatus(prev => ({ ...prev, unified: 'initialized' }));
        logger.info('Unified API Service ready');

        // Set overall ready state
        setIsReady(true);

      } catch (err) {
        logger.error('Service initialization error:', err);
        setError('Failed to initialize some services');
      }
    };

    initializeServices();
  }, [user]);

  // Set up user properties when user changes
  useEffect(() => {
    if (user) {
      ga4Service.setUserProperties({
        user_id: user.id,
        signup_date: user.created_at
      });
    } else {
      ga4Service.resetUser();
    }
  }, [user]);

  // Run CDN diagnostics periodically (admin only)
  useEffect(() => {
    if (status.cdn === 'initialized') {
      const runDiagnostics = async () => {
        const result = await runCDNDiagnostics();
        if (result.status !== 'healthy') {
          logger.warn('CDN diagnostics:', result);
        }
      };

      // Run immediately
      runDiagnostics();

      // Run every 30 minutes
      const interval = setInterval(runDiagnostics, 30 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [status.cdn]);

  // Register service worker for notifications
  useEffect(() => {
    if (status.firebase === 'initialized' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then(registration => {
          logger.info('Service Worker registered:', registration);
        })
        .catch(err => {
          logger.error('Service Worker registration failed:', err);
        });
    }
  }, [status.firebase]);

  return (
    <APIServicesContext.Provider value={{ status, isReady, error }}>
      {/* Google Analytics Script */}
      {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}
      
      {children}
    </APIServicesContext.Provider>
  );
}

// Initialization status component
export function APIServicesStatus() {
  const { status, isReady, error } = useAPIServices();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs max-w-xs">
      <h4 className="font-semibold text-white mb-2">API Services Status</h4>
      <div className="space-y-1">
        {Object.entries(status).map(([service, state]) => (
          <div key={service} className="flex items-center justify-between">
            <span className="text-gray-400 capitalize">{service}:</span>
            <span className={`ml-2 ${
              state === 'initialized' || state === 'not-required' ? 'text-green-400' : 
              state === 'error' ? 'text-red-400' : 
              'text-yellow-400'
            }`}>
              {state}
            </span>
          </div>
        ))}
      </div>
      {error && (
        <div className="mt-2 text-red-400 text-xs">
          {error}
        </div>
      )}
      <div className="mt-2 pt-2 border-t border-gray-700">
        <span className="text-gray-400">Ready:</span>
        <span className={`ml-2 ${isReady ? 'text-green-400' : 'text-yellow-400'}`}>
          {isReady ? 'Yes' : 'Initializing...'}
        </span>
      </div>
    </div>
  );
}