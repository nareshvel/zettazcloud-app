/**
 * Shared UI kit for the /system console — compact primitives mirroring
 * paisepath's components/system/ui.tsx, adapted to Zettaz's palette
 * (navy `primary`) and component set (ModalBase, shadcn-style classes).
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import ModalBase from '@/components/ui/ModalBase';

export function PageHeader({ eyebrow, title, icon: Icon, subtitle, actions }: {
  eyebrow?: string; title: string; icon?: LucideIcon; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</p>}
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          {Icon && <Icon className="h-6 w-6 text-primary-700" />}{title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'neutral', icon: Icon }: {
  label: string; value: ReactNode; sub?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'brand'; icon?: LucideIcon;
}) {
  const ring = {
    neutral: 'border-slate-200', good: 'border-emerald-200', warn: 'border-amber-200',
    bad: 'border-red-200', brand: 'border-primary-200',
  }[tone];
  const iconTone = {
    neutral: 'bg-slate-100 text-slate-600', good: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700', bad: 'bg-red-50 text-red-700', brand: 'bg-primary-50 text-primary-700',
  }[tone];
  return (
    <div className={cn('rounded-xl border bg-white p-4 shadow-sm', ring)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconTone)}><Icon className="h-3.5 w-3.5" /></span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export function Badge({ color = 'gray', children, className }: {
  color?: keyof typeof BADGE; children: ReactNode; className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', BADGE[color], className)}>
      {children}
    </span>
  );
}

export const statusColor = (s?: string | null): keyof typeof BADGE =>
  ({
    active: 'green', healthy: 'green', ok: 'green', resolved: 'green', success: 'green',
    trial: 'blue', open: 'blue', in_progress: 'blue', running: 'blue', info: 'blue',
    pending: 'amber', watch: 'amber', trial_ending: 'amber', warning: 'amber', high: 'amber', stale: 'amber',
    past_due: 'red', suspended: 'red', at_risk: 'red', error: 'red', failure: 'red',
    pending_deletion: 'red', critical: 'red', urgent: 'red', payment_grace: 'red',
    cancelled: 'gray', expired: 'gray', inactive: 'gray', closed: 'gray', lapsed: 'gray', low: 'gray', normal: 'gray',
  } as Record<string, keyof typeof BADGE>)[String(s)] || 'gray';

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode;
  footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}) {
  return (
    <ModalBase isOpen={open} onClose={onClose} title={title} footerContent={footer} size={size}>
      {children}
    </ModalBase>
  );
}

export function Field({ label, hint, error, required, children, className }: {
  label: string; hint?: string; error?: string; required?: boolean;
  children: ReactNode; className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error
        ? <span className="mt-1 block text-xs text-red-600">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-primary-500/20 disabled:bg-slate-50 disabled:text-slate-500';

export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-800 disabled:opacity-50',
  secondary: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50',
};

export function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-medium text-slate-800">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
      <span className="loading loading-spinner loading-sm" />{label}
    </div>
  );
}
