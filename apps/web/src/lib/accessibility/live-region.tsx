/**
 * Live region utilities for announcing dynamic content changes
 */

import { useEffect, useRef } from 'react';

/**
 * Live region component for screen reader announcements
 */
export interface LiveRegionProps {
  message: string
  level: 'off' | 'polite' | 'assertive'
  atomic?: boolean
  relevant?: 'additions' | 'removals' | 'text' | 'all'
  className?: string
}

export function LiveRegion({
  message,
  level,
  atomic = true,
  relevant = 'all',
  className = 'sr-only',
}: LiveRegionProps) {
  return (
    <div
      aria-live={level}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={className}
    >
      {message}
    </div>
  )
}

/**
 * Hook for creating and managing live regions
 */
export function useLiveRegion() {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region if it doesn't exist
    if (!liveRegionRef.current) {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      liveRegion.id = 'live-region-' + Math.random().toString(36).substr(2, 9);
      
      document.body.appendChild(liveRegion);
      liveRegionRef.current = liveRegion;
    }

    return () => {
      // Cleanup on unmount
      if (liveRegionRef.current && document.body.contains(liveRegionRef.current)) {
        document.body.removeChild(liveRegionRef.current);
      }
    };
  }, []);

  const announce = (
    message: string,
    level: 'polite' | 'assertive' = 'polite',
    atomic: boolean = true
  ) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', level);
      liveRegionRef.current.setAttribute('aria-atomic', atomic.toString());
      liveRegionRef.current.textContent = message;
      
      // Clear the message after announcement to allow re-announcement
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  return announce;
}

/**
 * Status announcer for form validation and user actions
 */
export function useStatusAnnouncer() {
  const announce = useLiveRegion();

  const announceSuccess = (message: string) => {
    announce(`Success: ${message}`, 'polite');
  };

  const announceError = (message: string) => {
    announce(`Error: ${message}`, 'assertive');
  };

  const announceWarning = (message: string) => {
    announce(`Warning: ${message}`, 'polite');
  };

  const announceInfo = (message: string) => {
    announce(`Information: ${message}`, 'polite');
  };

  const announceLoading = (action: string) => {
    announce(`Loading: ${action}`, 'polite');
  };

  const announceComplete = (action: string) => {
    announce(`Completed: ${action}`, 'polite');
  };

  return {
    announceSuccess,
    announceError,
    announceWarning,
    announceInfo,
    announceLoading,
    announceComplete,
    announce,
  };
}

/**
 * Progress announcer for long-running operations
 */
export function useProgressAnnouncer() {
  const announce = useLiveRegion();
  const lastAnnouncedRef = useRef<number>(0);

  const announceProgress = (
    current: number,
    total: number,
    action: string,
    announceEvery: number = 10 // Announce every 10% by default
  ) => {
    const percentage = Math.round((current / total) * 100);
    
    // Only announce at intervals to avoid spam
    if (percentage - lastAnnouncedRef.current >= announceEvery || percentage === 100) {
      lastAnnouncedRef.current = percentage;
      announce(`${action}: ${percentage}% complete`, 'polite');
    }
  };

  const announceStepProgress = (
    currentStep: number,
    totalSteps: number,
    stepName: string
  ) => {
    announce(`Step ${currentStep} of ${totalSteps}: ${stepName}`, 'polite');
  };

  return {
    announceProgress,
    announceStepProgress,
  };
}

/**
 * Route announcer for navigation changes
 */
export function useRouteAnnouncer() {
  const announce = useLiveRegion();

  const announceRouteChange = (pageName: string, isLoading: boolean = false) => {
    const message = isLoading 
      ? `Loading ${pageName} page`
      : `Navigated to ${pageName} page`;
    
    announce(message, 'polite');
  };

  const announcePageLoaded = (pageName: string) => {
    announce(`${pageName} page loaded`, 'polite');
  };

  return {
    announceRouteChange,
    announcePageLoaded,
  };
}

/**
 * Data table announcer for sorting and filtering
 */
export function useTableAnnouncer() {
  const announce = useLiveRegion();

  const announceSortChange = (column: string, direction: 'asc' | 'desc') => {
    const directionText = direction === 'asc' ? 'ascending' : 'descending';
    announce(`Table sorted by ${column}, ${directionText}`, 'polite');
  };

  const announceFilterChange = (filterType: string, value: string, resultCount: number) => {
    announce(`Filtered by ${filterType}: ${value}. ${resultCount} results found`, 'polite');
  };

  const announcePageChange = (currentPage: number, totalPages: number) => {
    announce(`Page ${currentPage} of ${totalPages}`, 'polite');
  };

  const announceRowSelection = (selectedCount: number, totalCount: number) => {
    if (selectedCount === 0) {
      announce('No rows selected', 'polite');
    } else if (selectedCount === totalCount) {
      announce('All rows selected', 'polite');
    } else {
      announce(`${selectedCount} of ${totalCount} rows selected`, 'polite');
    }
  };

  return {
    announceSortChange,
    announceFilterChange,
    announcePageChange,
    announceRowSelection,
  };
}

/**
 * Form announcer for validation and submission
 */
export function useFormAnnouncer() {
  const announce = useLiveRegion();

  const announceFieldError = (fieldName: string, error: string) => {
    announce(`${fieldName}: ${error}`, 'assertive');
  };

  const announceFormErrors = (errorCount: number) => {
    if (errorCount === 1) {
      announce('Form has 1 error. Please review and correct.', 'assertive');
    } else if (errorCount > 1) {
      announce(`Form has ${errorCount} errors. Please review and correct.`, 'assertive');
    }
  };

  const announceFormSubmission = (isSubmitting: boolean) => {
    if (isSubmitting) {
      announce('Submitting form...', 'polite');
    }
  };

  const announceFormSuccess = (message: string = 'Form submitted successfully') => {
    announce(message, 'polite');
  };

  return {
    announceFieldError,
    announceFormErrors,
    announceFormSubmission,
    announceFormSuccess,
  };
}

/**
 * Search announcer for search results and filtering
 */
export function useSearchAnnouncer() {
  const announce = useLiveRegion();

  const announceSearchResults = (query: string, resultCount: number) => {
    if (resultCount === 0) {
      announce(`No results found for "${query}"`, 'polite');
    } else if (resultCount === 1) {
      announce(`1 result found for "${query}"`, 'polite');
    } else {
      announce(`${resultCount} results found for "${query}"`, 'polite');
    }
  };

  const announceSearchSuggestion = (suggestion: string) => {
    announce(`Suggestion: ${suggestion}`, 'polite');
  };

  const announceSearchCleared = () => {
    announce('Search cleared', 'polite');
  };

  return {
    announceSearchResults,
    announceSearchSuggestion,
    announceSearchCleared,
  };
}