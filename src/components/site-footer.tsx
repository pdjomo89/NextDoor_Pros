import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SUPPORT_PHONES } from '@/lib/contact';

export function SiteFooter() {
  const t = useTranslations('Footer');
  const tNav = useTranslations('Nav');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-navy/10 bg-navy text-white">
      <div className="container grid gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center">
            <span className="grid h-20 w-20 place-items-center rounded-xl bg-white p-1.5">
              <Image
                src="/logo.png"
                alt={tNav('brand')}
                width={1254}
                height={1254}
                className="h-full w-full"
              />
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-white/70">{t('tagline')}</p>
          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              {t('customerService')}
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {SUPPORT_PHONES.map((p) => (
                <li key={p.href}>
                  <a href={p.href} className="text-white/80 hover:text-forest-200">
                    {p.display}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            {t('explore')}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/services" className="text-white/80 hover:text-forest-200">
                {tNav('services')}
              </Link>
            </li>
            <li>
              <Link href="/jobs" className="text-white/80 hover:text-forest-200">
                {tNav('jobs')}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-white/80 hover:text-forest-200">
                {tNav('pricing')}
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-white/80 hover:text-forest-200">
                {tNav('about')}
              </Link>
            </li>
            <li>
              <Link href="/partners" className="text-white/80 hover:text-forest-200">
                {tNav('partners')}
              </Link>
            </li>
            <li>
              <Link href="/news" className="text-white/80 hover:text-forest-200">
                {tNav('news')}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-white/80 hover:text-forest-200">
                {tNav('contact')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            {t('legal')}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="#" className="text-white/80 hover:text-forest-200">
                {t('privacy')}
              </a>
            </li>
            <li>
              <a href="#" className="text-white/80 hover:text-forest-200">
                {t('terms')}
              </a>
            </li>
            <li>
              <a href="#" className="text-white/80 hover:text-forest-200">
                {t('cookies')}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-4 text-xs text-white/60 sm:flex-row">
          <span>
            © {year} {tNav('brand')}. {t('rights')}
          </span>
          <span>Made in Canada 🇨🇦</span>
        </div>
      </div>
    </footer>
  );
}
