'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { getCityBySlug } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { JobDoc } from '@/lib/job-types';
import type { Locale } from '@/i18n/routing';

function digits(n: string) {
  return n.replace(/[^\d]/g, '');
}

function formatCents(cents: number, locale: string) {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100);
}

type Application = {
  _id: Id<'jobApplications'>;
  _creationTime: number;
  status: string;
  message?: string;
  contractor: {
    _id: Id<'contractors'>;
    businessName: string;
    citySlug: string;
    province: string;
    ratingCount: number;
    ratingSum: number;
    stripeOnboardingComplete: boolean;
  } | null;
};

export function JobDetail({ locale: _, id }: { locale: Locale; id: string }) {
  const t = useTranslations('Jobs');
  const tCat = useTranslations('Services.categories');
  const locale = useLocale();

  const job = useQuery(api.jobs.get, { id: id as never }) as
    | JobDoc
    | null
    | undefined;
  const viewer = useQuery(api.contractors.viewer) as
    | { _id: string; email: string | null }
    | null
    | undefined;

  const isPaid =
    job?.paymentStatus !== undefined &&
    job.paymentStatus !== 'none' &&
    job.paymentStatus !== 'failed';
  const isFundedPaid = job?.paymentStatus === 'funded';
  const isOwner = !!viewer && !!job && viewer._id === job.posterId;

  // Fetch applications when this is a funded paid job owned by viewer.
  const applications = useQuery(
    api.jobs.listApplicationsForJob,
    isOwner && isPaid ? { jobId: id as never } : 'skip',
  ) as Application[] | undefined;

  // Pro's own application to this job (so we know whether to show Apply / Withdrawn / Pending).
  const myApplication = useQuery(
    api.jobs.myApplicationForJob,
    !isOwner && isFundedPaid ? { jobId: id as never } : 'skip',
  ) as { _id: Id<'jobApplications'>; status: string; message?: string } | null | undefined;

  // The viewer's contractor record (to gate Apply behind Stripe onboarding).
  const myContractor = useQuery(api.contractors.getMine) as
    | { _id: string; stripeOnboardingComplete?: boolean }
    | null
    | undefined;

  const closeJob = useMutation(api.jobs.update);
  const deleteJob = useMutation(api.jobs.deleteMine);
  const applyToJob = useMutation(api.jobs.applyToJob);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);
  const selectApplicant = useMutation(api.jobs.selectApplicant);
  const markJobComplete = useAction(api.jobs.markJobComplete);
  const cancelJob = useAction(api.jobs.cancelJob);

  const [actionBusy, setActionBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [applyMessage, setApplyMessage] = React.useState('');
  const [showApplyForm, setShowApplyForm] = React.useState(false);

  if (job === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="rounded-xl border border-navy/10 bg-white p-8 text-center">
        <p className="font-semibold text-navy">{t('notFound')}</p>
        <Button asChild variant="ghost" size="sm" className="mt-3">
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
            {t('backToJobs')}
          </Link>
        </Button>
      </div>
    );
  }

  const city = getCityBySlug(job.citySlug);
  const cat = SERVICE_CATEGORIES.find((c) => c.key === job.category);
  const categoryLabel = cat ? tCat(`${cat.key}.title`) : t('categoryOther');
  const postedAt = new Date(job._creationTime).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  async function run<T>(key: string, fn: () => Promise<T>) {
    setError(null);
    setActionBusy(key);
    try {
      return await fn();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  }

  async function onClose() {
    if (!confirm(t('confirmClose'))) return;
    await run('close', () =>
      closeJob({ id: job!._id as never, status: 'closed' }),
    );
  }

  async function onDelete() {
    if (!confirm(t('confirmDelete'))) return;
    await run('delete', () => deleteJob({ id: job!._id as never }));
    window.location.href = '/jobs';
  }

  async function onApply() {
    await run('apply', async () => {
      await applyToJob({
        jobId: job!._id as never,
        message: applyMessage.trim() || undefined,
      });
      setShowApplyForm(false);
      setApplyMessage('');
    });
  }

  async function onWithdraw() {
    if (!myApplication) return;
    if (!confirm(t('paid.confirmWithdraw'))) return;
    await run('withdraw', () =>
      withdrawApplication({ applicationId: myApplication._id }),
    );
  }

  async function onSelect(applicationId: Id<'jobApplications'>) {
    if (!confirm(t('paid.confirmSelect'))) return;
    await run(`select_${applicationId}`, () =>
      selectApplicant({ applicationId }),
    );
  }

  async function onMarkComplete() {
    if (!confirm(t('paid.confirmComplete'))) return;
    await run('complete', () => markJobComplete({ jobId: job!._id as never }));
  }

  async function onCancel() {
    if (!confirm(t('paid.confirmCancel'))) return;
    await run('cancel', () => cancelJob({ jobId: job!._id as never }));
  }

  const paymentBadge = isPaid ? paymentBadgeFor(job, t) : null;

  return (
    <article className="rounded-2xl border border-navy/10 bg-white p-6 sm:p-8">
      {job.paymentStatus === 'pending' && isOwner && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('paid.pendingNotice')}</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-balance text-3xl font-bold text-navy">{job.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
            {categoryLabel}
          </span>
          {paymentBadge}
        </div>
      </div>

      {!isPaid && job.status !== 'open' && (
        <p className="mt-3 inline-block rounded-full bg-navy/10 px-3 py-1 text-xs font-medium text-navy">
          {job.status === 'closed' ? t('statusClosed') : t('statusFilled')}
        </p>
      )}

      <dl className="mt-5 grid gap-2 text-sm text-navy/70 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-forest" />
          {city ? `${city.name}, ${city.province}` : job.citySlug}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-forest" />
          {t('postedOn', { date: postedAt })}
        </div>
        {isPaid && job.budgetCents !== undefined ? (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-forest" />
            <span>
              <strong className="text-navy">{t('paid.budgetLabel')}:</strong>{' '}
              {formatCents(job.budgetCents, locale)}
            </span>
          </div>
        ) : (
          job.budget && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-forest" />
              <span>
                <strong className="text-navy">{t('budget')}:</strong> {job.budget}
              </span>
            </div>
          )
        )}
        {job.timing && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-forest" />
            <span>
              <strong className="text-navy">{t('timing')}:</strong> {job.timing}
            </span>
          </div>
        )}
      </dl>

      <div className="mt-6 whitespace-pre-line text-navy/90">
        {job.description}
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Free-post contact block — only on free open jobs */}
      {!isPaid && job.status === 'open' && (
        <div className="mt-8 rounded-xl border border-navy/10 bg-navy/5 p-5">
          <h2 className="font-semibold text-navy">{t('contactSection')}</h2>
          <p className="mt-1 text-sm text-navy/70">{t('contactHelp')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {job.contactPhone && (
              <Button asChild variant="primary" size="sm">
                <a href={`tel:${digits(job.contactPhone)}`}>
                  <Phone className="h-4 w-4" />
                  {t('call')}
                </a>
              </Button>
            )}
            {job.contactEmail && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={`mailto:${job.contactEmail}?subject=${encodeURIComponent(job.title)}`}
                >
                  <Mail className="h-4 w-4" />
                  {t('emailAction')}
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Pro-side apply UI on funded paid jobs */}
      {isFundedPaid && !isOwner && (
        <div className="mt-8 rounded-xl border border-forest/30 bg-forest/[0.04] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <ShieldCheck className="h-4 w-4 text-forest" />
            {t('paid.applySectionTitle')}
          </h2>
          <p className="mt-1 text-sm text-navy/70">{t('paid.applySectionIntro')}</p>

          {/* Not signed in */}
          {viewer === null && (
            <p className="mt-3 text-sm text-navy/70">
              {t('paid.applySignIn')}{' '}
              <Link href="/auth/sign-in" className="font-medium text-forest hover:underline">
                {t('paid.signInLink')}
              </Link>
            </p>
          )}

          {/* Signed in but no pro profile */}
          {viewer && myContractor === null && (
            <p className="mt-3 text-sm text-navy/70">
              {t('paid.applyNeedsListing')}{' '}
              <Link href="/pros/onboard" className="font-medium text-forest hover:underline">
                {t('paid.createListing')}
              </Link>
            </p>
          )}

          {/* Has profile, but Stripe not yet onboarded */}
          {viewer &&
            myContractor &&
            myContractor.stripeOnboardingComplete !== true && (
              <p className="mt-3 text-sm text-navy/70">
                {t('paid.applyNeedsStripe')}{' '}
                <Link href="/pros/dashboard" className="font-medium text-forest hover:underline">
                  {t('paid.goToDashboard')}
                </Link>
              </p>
            )}

          {/* Ready to apply */}
          {viewer &&
            myContractor &&
            myContractor.stripeOnboardingComplete === true && (
              <div className="mt-3">
                {myApplication ? (
                  <ApplicationStatusForPro
                    application={myApplication}
                    onWithdraw={onWithdraw}
                    busy={actionBusy === 'withdraw'}
                    t={t}
                  />
                ) : showApplyForm ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onApply();
                    }}
                    className="space-y-3"
                  >
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/55">
                        {t('paid.applyMessageLabel')}
                      </span>
                      <textarea
                        value={applyMessage}
                        rows={3}
                        maxLength={1000}
                        onChange={(e) => setApplyMessage(e.target.value)}
                        placeholder={t('paid.applyMessagePlaceholder')}
                        className="form-input-job resize-y"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        disabled={actionBusy === 'apply'}
                      >
                        {actionBusy === 'apply' && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {t('paid.submitApply')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApplyForm(false)}
                      >
                        {t('paid.cancel')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowApplyForm(true)}
                  >
                    {t('paid.applyButton')}
                  </Button>
                )}
              </div>
            )}
        </div>
      )}

      {/* Customer-side applicants list and lifecycle controls */}
      {isOwner && isPaid && (
        <CustomerControls
          job={job}
          applications={applications}
          locale={locale}
          actionBusy={actionBusy}
          onSelect={onSelect}
          onMarkComplete={onMarkComplete}
          onCancel={onCancel}
          t={t}
        />
      )}

      {/* Standard owner controls (close / delete) — hidden for in-flight paid jobs */}
      {isOwner && !isPaid && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-navy/10 pt-5">
          {job.status === 'open' && (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <XCircle className="h-4 w-4" />
              {t('closeJob')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {t('deleteJob')}
          </Button>
        </div>
      )}

      <style jsx>{`
        :global(.form-input-job) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(215 20% 88%);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(215 60% 12%);
          outline: none;
        }
        :global(.form-input-job:focus) {
          border-color: #1f8a3b;
          box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
        }
      `}</style>
    </article>
  );
}

function paymentBadgeFor(job: JobDoc, t: ReturnType<typeof useTranslations>) {
  const status = job.paymentStatus;
  const map: Record<string, { label: string; cls: string; Icon: typeof Lock }> = {
    pending: {
      label: t('paid.statusPending'),
      cls: 'bg-amber-50 text-amber-800 border border-amber-200',
      Icon: Clock,
    },
    funded: {
      label: t('paid.statusFunded'),
      cls: 'bg-forest/10 text-forest border border-forest/30',
      Icon: Lock,
    },
    released: {
      label: t('paid.statusReleased'),
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      Icon: CheckCircle2,
    },
    refunded: {
      label: t('paid.statusRefunded'),
      cls: 'bg-navy/10 text-navy/70 border border-navy/15',
      Icon: RefreshCw,
    },
    failed: {
      label: t('paid.statusFailed'),
      cls: 'bg-red-50 text-red-700 border border-red-200',
      Icon: AlertTriangle,
    },
  };
  if (!status || !(status in map)) return null;
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function ApplicationStatusForPro({
  application,
  onWithdraw,
  busy,
  t,
}: {
  application: { status: string; message?: string };
  onWithdraw: () => void;
  busy: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (application.status === 'accepted') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <p className="font-semibold">{t('paid.youWereSelected')}</p>
        <p className="mt-1">{t('paid.youWereSelectedBody')}</p>
      </div>
    );
  }
  if (application.status === 'rejected') {
    return (
      <p className="text-sm text-navy/70">{t('paid.applicationRejected')}</p>
    );
  }
  if (application.status === 'withdrawn') {
    return (
      <p className="text-sm text-navy/70">{t('paid.applicationWithdrawn')}</p>
    );
  }
  // pending
  return (
    <div className="space-y-2">
      <p className="text-sm text-navy/80">{t('paid.applicationPending')}</p>
      {application.message && (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-navy/70">
          {application.message}
        </p>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onWithdraw} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('paid.withdrawApplication')}
      </Button>
    </div>
  );
}

function CustomerControls({
  job,
  applications,
  locale,
  actionBusy,
  onSelect,
  onMarkComplete,
  onCancel,
  t,
}: {
  job: JobDoc;
  applications: Application[] | undefined;
  locale: string;
  actionBusy: string | null;
  onSelect: (id: Id<'jobApplications'>) => void;
  onMarkComplete: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasPicked = !!job.selectedContractorId;

  return (
    <div className="mt-8 space-y-5 border-t border-navy/10 pt-6">
      <h2 className="text-lg font-semibold text-navy">
        {t('paid.applicantsTitle')}
      </h2>

      {/* Released / refunded — show terminal banner */}
      {job.paymentStatus === 'released' && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t('paid.releasedTitle')}</p>
            <p className="mt-1">
              {t('paid.releasedBody', {
                amount:
                  job.budgetCents !== undefined && job.applicationFeeCents !== undefined
                    ? formatCents(job.budgetCents - job.applicationFeeCents, locale)
                    : '',
              })}
            </p>
          </div>
        </div>
      )}
      {job.paymentStatus === 'refunded' && (
        <div className="rounded-xl border border-navy/15 bg-navy/5 p-4 text-sm text-navy/80">
          <p className="font-semibold">{t('paid.refundedTitle')}</p>
          <p className="mt-1">{t('paid.refundedBody')}</p>
        </div>
      )}

      {/* Funded — list applicants + lifecycle buttons */}
      {job.paymentStatus === 'funded' && (
        <>
          {applications === undefined ? (
            <div className="flex items-center justify-center py-6 text-navy/60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy/15 px-4 py-6 text-center text-sm text-navy/55">
              {t('paid.noApplicants')}
            </p>
          ) : (
            <ul className="space-y-2">
              {applications.map((a) => (
                <li
                  key={a._id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-navy/10 bg-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">
                      {a.contractor ? (
                        <Link
                          href={`/pros/${a.contractor._id}`}
                          className="hover:text-forest hover:underline"
                        >
                          {a.contractor.businessName}
                        </Link>
                      ) : (
                        t('paid.unknownPro')
                      )}
                      {a.status === 'accepted' && (
                        <span className="ml-2 rounded bg-forest/10 px-1.5 py-0.5 text-[10px] font-semibold text-forest">
                          {t('paid.selectedBadge')}
                        </span>
                      )}
                      {a.status === 'rejected' && (
                        <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-semibold text-navy/60">
                          {t('paid.rejectedBadge')}
                        </span>
                      )}
                    </p>
                    {a.message && (
                      <p className="mt-1 text-sm text-navy/70">{a.message}</p>
                    )}
                  </div>
                  {!hasPicked && a.status === 'pending' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onSelect(a._id)}
                      disabled={actionBusy === `select_${a._id}`}
                    >
                      {actionBusy === `select_${a._id}` && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {t('paid.selectButton')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {hasPicked ? (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={onMarkComplete}
                disabled={actionBusy === 'complete'}
              >
                {actionBusy === 'complete' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('paid.markCompleteButton')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={actionBusy === 'cancel'}
                className="text-red-700 hover:text-red-800"
              >
                {actionBusy === 'cancel' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <XCircle className="h-4 w-4" />
                {t('paid.cancelAndRefundButton')}
              </Button>
            )}
          </div>

          {hasPicked && (
            <p className="flex items-center gap-1.5 text-xs text-navy/55">
              <CreditCard className="h-3.5 w-3.5 text-forest" />
              {t('paid.markCompleteHint')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
