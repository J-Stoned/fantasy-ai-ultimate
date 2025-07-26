/**
 * Google Analytics gtag helper
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID!;

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Helper to ensure gtag is available
export const gtag = (...args: any[]): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
};