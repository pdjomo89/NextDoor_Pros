import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only star rating display (supports fractional values). */
export function StarRating({
  value,
  count,
  size = 'sm',
  className,
}: {
  value: number;
  /** If provided, shows "(n)" after the stars. */
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  const star = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const text = size === 'md' ? 'text-sm' : 'text-xs';
  const label =
    count !== undefined
      ? `${clamped.toFixed(1)} out of 5 (${count} review${count === 1 ? '' : 's'})`
      : `${clamped.toFixed(1)} out of 5`;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} aria-label={label} title={label}>
      <span className="relative inline-flex">
        <span className="flex text-navy/15">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(star, 'shrink-0')} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
        <span
          className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-400"
          style={{ width: `${pct}%` }}
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(star, 'shrink-0')} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
      </span>
      {count !== undefined ? (
        <span className={cn('font-medium text-navy/70', text)}>
          {clamped.toFixed(1)} <span className="text-navy/40">({count})</span>
        </span>
      ) : null}
    </span>
  );
}
