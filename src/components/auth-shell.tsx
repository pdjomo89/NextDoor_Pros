import Image from 'next/image';
import { Check } from 'lucide-react';

const BRAND_IMAGE =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=70';

export function AuthShell({
  brandHeadline,
  brandPoints,
  title,
  subtitle,
  children,
}: {
  brandHeadline: string;
  brandPoints: string[];
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container py-12 md:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-lg shadow-navy/10 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between p-10 text-white lg:flex">
          <Image
            src={BRAND_IMAGE}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 50vw, 0px"
            className="-z-10 object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy via-navy/95 to-navy-600/95" />
          <span className="text-xl font-bold tracking-tight">
            NextDoor<span className="text-forest-300"> Pros</span>
          </span>
          <div>
            <p className="text-balance text-2xl font-bold leading-snug">{brandHeadline}</p>
            <ul className="mt-6 space-y-3">
              {brandPoints.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-white/85">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-forest/30 text-forest-100">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10 lg:p-12">
          <h1 className="text-2xl font-bold text-navy">{title}</h1>
          <p className="mt-2 text-sm text-navy/70">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
