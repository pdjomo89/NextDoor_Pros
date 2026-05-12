import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=70';

export function JobsHero({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel,
  compact = false,
  image = DEFAULT_HERO_IMAGE,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  compact?: boolean;
  image?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl text-white shadow-lg shadow-navy/20">
      <Image
        src={image}
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-navy/55" />
      <div className={cn('px-6 sm:px-10', compact ? 'py-8 sm:py-10' : 'py-12 sm:py-16')}>
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        {eyebrow && (
          <span className="inline-block rounded-full bg-forest/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
            {eyebrow}
          </span>
        )}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1
              className={cn(
                'text-balance font-bold tracking-tight drop-shadow-sm',
                compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-5xl',
              )}
            >
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-white/80">{subtitle}</p>}
          </div>
          {children && <div className="flex flex-wrap gap-2">{children}</div>}
        </div>
      </div>
    </section>
  );
}
