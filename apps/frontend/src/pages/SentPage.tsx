import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emailsApi, sendersApi } from '../services/api';
import type { EmailJob } from '../types';
import { CheckCircle, Search, RefreshCw, Send, Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import Table, { type Column } from '../components/ui/Table';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ComposeModal from '../components/ComposeModal';

export default function SentPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.list().then((r) => r.data),
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['emails', 'sent', page, activeSearch],
    queryFn: async () => {
      if (activeSearch) {
        const res = await emailsApi.search(activeSearch, page);
        return {
          emails: res.data.results,
          total: res.data.total,
          page: res.data.page,
          limit: res.data.limit,
          fallback: res.data.fallback,
        };
      }
      return emailsApi.sent(page, 25).then((r) => r.data);
    },
    refetchInterval: activeSearch ? false : 12_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

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
      key: 'sentAt',
      header: 'Sent Time',
      className: 'text-xs text-gray-400 whitespace-nowrap',
      render: (job) => (
        <div className="flex items-center gap-1.5 text-gray-300">
          <Send className="w-3.5 h-3.5 text-emerald-400" />
          {formatDate(job.sentAt || job.createdAt)}
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Sent Emails</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            History of successfully delivered and attempted emails · {data?.total ?? 0} total
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

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2.5 max-w-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search sent emails by recipient, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 py-2 text-xs"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
        {activeSearch && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveSearch('');
              setSearchQuery('');
            }}
          >
            Clear
          </Button>
        )}
      </form>

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
              icon={<CheckCircle className="w-8 h-8 text-emerald-400" />}
              title={activeSearch ? 'No matching sent emails' : 'No sent emails yet'}
              description={
                activeSearch
                  ? `No sent emails matched your query "${activeSearch}".`
                  : 'Emails that have completed sending will appear here.'
              }
              action={
                activeSearch ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActiveSearch('');
                      setSearchQuery('');
                    }}
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => setShowCompose(true)}
                  >
                    Compose New Email
                  </Button>
                )
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
