import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emailsApi, sendersApi } from '../services/api';
import type { EmailJob } from '../types';
import { Clock, RefreshCw, Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import Table, { type Column } from '../components/ui/Table';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ComposeModal from '../components/ComposeModal';

export default function ScheduledPage() {
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['emails', 'scheduled', page],
    queryFn: () => emailsApi.scheduled(page, 25).then((r) => r.data),
    refetchInterval: 12_000,
  });

  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.list().then((r) => r.data),
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const columns: Column<EmailJob>[] = [
    {
      key: 'recipient',
      header: 'Email',
      className: 'w-1/4 font-mono text-xs sm:text-sm text-gray-200',
      render: (job) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-100">{job.recipient}</span>
          {job.sender && (
            <span className="text-[11px] text-gray-500 font-sans">
              From: {job.sender.displayName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      className: 'w-1/3 text-gray-300',
      render: (job) => (
        <span className="truncate block max-w-xs sm:max-w-md" title={job.subject}>
          {job.subject}
        </span>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled Time',
      className: 'text-xs text-gray-400 whitespace-nowrap',
      render: (job) => (
        <div className="flex items-center gap-1.5 text-gray-300">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          {formatDate(job.scheduledAt)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'text-right pr-6',
      render: (job) => (
        <div className="flex justify-end">
          <StatusBadge status={job.status} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Scheduled Emails</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Emails queued in BullMQ and scheduled for transmission · {data?.total ?? 0} total
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCompose(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Compose New Email
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card p-6 border border-white/10 shadow-xl bg-surface-1/90">
        <Table<EmailJob>
          columns={columns}
          data={data?.emails ?? []}
          keyExtractor={(job) => job.id}
          isLoading={isLoading}
          page={page}
          total={data?.total ?? 0}
          limit={data?.limit ?? 25}
          onPageChange={setPage}
          emptyState={
            <EmptyState
              icon={<Clock className="w-8 h-8 text-brand-400" />}
              title="No scheduled emails"
              description="There are currently no emails waiting in the scheduler queue."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCompose(true)}
                >
                  Compose New Email
                </Button>
              }
            />
          }
        />
      </div>

      <ComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        onSuccess={() => {
          setShowCompose(false);
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        }}
        initialSenders={sendersData?.senders ?? []}
      />
    </div>
  );
}
