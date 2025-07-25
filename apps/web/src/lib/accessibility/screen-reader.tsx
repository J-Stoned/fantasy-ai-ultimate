/**
 * Screen reader utilities and components
 */

import { useEffect } from 'react';

/**
 * Screen reader only text component
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Hook for announcing dynamic content to screen readers
 */
export function useScreenReaderAnnouncement() {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove the announcement after it's been read
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  return announce;
}

/**
 * Accessible image component with proper alt text
 */
export interface AccessibleImageProps {
  src: string;
  alt: string;
  decorative?: boolean;
  longDescription?: string;
  caption?: string;
  className?: string;
}

export function AccessibleImage({
  src,
  alt,
  decorative = false,
  longDescription,
  caption,
  className,
}: AccessibleImageProps) {
  const imageProps = decorative
    ? { 'aria-hidden': true, alt: '' }
    : { alt, 'aria-describedby': longDescription ? 'img-desc' : undefined };

  return (
    <figure className={className}>
      <img src={src} {...imageProps} />
      {longDescription && !decorative && (
        <div id="img-desc" className="sr-only">
          {longDescription}
        </div>
      )}
      {caption && (
        <figcaption className="text-sm text-gray-600 mt-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Accessible heading component with proper hierarchy
 */
export interface AccessibleHeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function AccessibleHeading({ level, children, className, id }: AccessibleHeadingProps) {
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <HeadingTag className={className} id={id}>
      {children}
    </HeadingTag>
  );
}

/**
 * Accessible data table with proper headers and captions
 */
export interface AccessibleTableProps {
  caption: string;
  headers: string[];
  data: Array<Record<string, any>>;
  className?: string;
  sortable?: boolean;
  onSort?: (column: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}

export function AccessibleTable({
  caption,
  headers,
  data,
  className,
  sortable = false,
  onSort,
  sortColumn,
  sortDirection,
}: AccessibleTableProps) {
  return (
    <table className={className} role="table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr role="row">
          {headers.map((header, index) => (
            <th
              key={index}
              role="columnheader"
              scope="col"
              aria-sort={
                sortable && sortColumn === header
                  ? sortDirection
                  : sortable
                  ? 'none'
                  : undefined
              }
              className={sortable ? 'cursor-pointer' : undefined}
              onClick={sortable && onSort ? () => onSort(header) : undefined}
            >
              {header}
              {sortable && sortColumn === header && (
                <span aria-hidden="true" className="ml-1">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} role="row">
            {headers.map((header, cellIndex) => (
              <td key={cellIndex} role="gridcell">
                {row[header]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Progress indicator with screen reader support
 */
export interface AccessibleProgressProps {
  value: number;
  max: number;
  label: string;
  showPercentage?: boolean;
  className?: string;
}

export function AccessibleProgress({
  value,
  max,
  label,
  showPercentage = true,
  className,
}: AccessibleProgressProps) {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium">{label}</span>
        {showPercentage && (
          <span className="text-sm text-gray-600">{percentage}%</span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${percentage}% complete`}
        className="w-full bg-gray-200 rounded-full h-2"
      >
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Accessible loading indicator
 */
export interface AccessibleLoadingProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AccessibleLoading({
  label = 'Loading',
  size = 'md',
  className,
}: AccessibleLoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div
        role="status"
        aria-label={label}
        className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Status message component for dynamic updates
 */
export interface StatusMessageProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  live?: 'off' | 'polite' | 'assertive';
  className?: string;
}

export function StatusMessage({
  message,
  type,
  live = 'polite',
  className,
}: StatusMessageProps) {
  const typeStyles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      role="status"
      aria-live={live}
      className={`flex items-center p-3 border rounded-md ${typeStyles[type]} ${className}`}
    >
      <span aria-hidden="true" className="mr-2">
        {icons[type]}
      </span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Breadcrumb navigation with proper ARIA
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface AccessibleBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function AccessibleBreadcrumb({ items, className }: AccessibleBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol role="list" className="flex items-center space-x-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span aria-hidden="true" className="mx-2 text-gray-400">
                /
              </span>
            )}
            {item.href && !item.current ? (
              <a
                href={item.href}
                className="text-blue-600 hover:text-blue-800 hover:underline"
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
              </a>
            ) : (
              <span
                className={item.current ? 'text-gray-900 font-medium' : 'text-gray-600'}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}