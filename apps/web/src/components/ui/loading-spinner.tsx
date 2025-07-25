import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 border-2',
  md: 'w-12 h-12 border-3',
  lg: 'w-16 h-16 border-4',
  xl: 'w-20 h-20 border-4'
};

const colorClasses = {
  primary: 'border-blue-500',
  secondary: 'border-gray-500',
  success: 'border-emerald-500',
  warning: 'border-yellow-500',
  danger: 'border-red-500'
};

export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary', 
  label,
  className 
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div
        className={cn(
          'rounded-full border-t-transparent animate-spin',
          sizeClasses[size],
          colorClasses[color]
        )}
      />
      {label && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{label}</p>
      )}
    </div>
  );
}

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

export function ComponentLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <LoadingSpinner size="md" label={label} />
    </div>
  );
}