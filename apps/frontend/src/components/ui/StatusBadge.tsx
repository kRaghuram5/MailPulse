import type { EmailJobStatus } from '../../types';

interface BadgeProps {
  status: EmailJobStatus | string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  SCHEDULED: {
    label: 'Scheduled',
    badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  PROCESSING: {
    label: 'Processing',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  SENT: {
    label: 'Sent',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  sent: {
    label: 'Sent',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  FAILED: {
    label: 'Failed',
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  RATE_LIMITED: {
    label: 'Rate Limited',
    badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    dotClass: 'bg-orange-400',
  },
};

export default function StatusBadge({ status, size = 'sm' }: BadgeProps) {
  const normalized = status ? status.toUpperCase() : 'UNKNOWN';
  const cfg = statusConfig[normalized] || statusConfig[status] || {
    label: status,
    badgeClass: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
    dotClass: 'bg-gray-400',
  };

  const sizeClass = size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${cfg.badgeClass} ${sizeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
