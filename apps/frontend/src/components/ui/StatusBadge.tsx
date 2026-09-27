import type { EmailJob } from '../../services/api';

interface BadgeProps {
  status: EmailJob['status'];
}

const statusConfig: Record<EmailJob['status'], { label: string; className: string }> = {
  SCHEDULED: { label: 'Scheduled', className: 'badge-scheduled' },
  PROCESSING: { label: 'Processing', className: 'badge-processing' },
  SENT: { label: 'Sent', className: 'badge-sent' },
  FAILED: { label: 'Failed', className: 'badge-failed' },
  RATE_LIMITED: { label: 'Rate Limited', className: 'badge-rate-limited' },
};

export default function StatusBadge({ status }: BadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, className: 'badge bg-gray-500/20 text-gray-300' };
  return <span className={cfg.className}>{cfg.label}</span>;
}
