import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variantStyles = {
  default: 'bg-card text-card-foreground',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

const iconBgStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-white/20',
  success: 'bg-white/20',
  warning: 'bg-black/10',
  destructive: 'bg-white/20',
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p
            className={cn(
              'text-xs font-medium',
              variant === 'default'
                ? 'text-muted-foreground'
                : 'text-white/80'
            )}
          >
            {label}
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                variant === 'default' && trend.positive
                  ? 'text-success'
                  : variant === 'default' && !trend.positive
                    ? 'text-destructive'
                    : 'text-white/80'
              )}
            >
              {trend.positive ? '+' : ''}
              {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            iconBgStyles[variant]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
