import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emailsApi, sendersApi } from '../services/api';
import type { EmailJob } from '../types';
import {
  Plus,
  Clock,
  CheckCircle,
  RefreshCw,
  Search,
  Users,
  AlertTriangle,
  Mail,
  Send,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Table, { type Column } from '../components/ui/Table';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ComposeModal from '../components/ComposeModal';

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Active tab: 'scheduled' | 'sent'
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'sent' ? 'sent' : 'scheduled';

  const setActiveTab = (tab: 'scheduled' | 'sent') => {
    setSearchParams({ tab });
  };

  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Pagination per tab
  const [scheduledPage, setScheduledPage] = useState(1);
  const [sentPage, setSentPage] = useState(1);

  // Senders Query
  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.list().then((r) => r.data),
  });

  // Scheduled Emails Query
  const {
    data: scheduledData,
    isLoading: isScheduledLoading,
    isFetching: isScheduledFetching,
    refetch: refetchScheduled,
  } = useQuery({
    queryKey: ['emails', 'scheduled', scheduledPage],
    queryFn: () => emailsApi.scheduled(scheduledPage, 25).then((r) => r.data),
    refetchInterval: 10_000,
  });

  // Sent Emails Query (or Search Query)
  const {
    data: sentData,
    isLoading: isSentLoading,
    isFetching: isSentFetching,
    refetch: refetchSent,
  } = useQuery({
    queryKey: ['emails', 'sent', sentPage, activeSearch],
    queryFn: async () => {
      if (activeSearch) {
        const res = await emailsApi.search(activeSearch, sentPage);
        return {
          emails: res.data.results,
          total: res.data.total,
          page: res.data.page,
          limit: res.data.limit,
          fallback: res.data.fallback,
        };
      }
      return emailsApi.sent(sentPage, 25).then((r) => r.data);
    },
    refetchInterval: activeSearch ? false : 10_000,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setSentPage(1);
    // If user searches while on scheduled tab, switch to search results in sent/archive or filter
    if (activeTab !== 'sent') {
      setActiveTab('sent');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
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

  // Scheduled table columns
  const scheduledColumns: Column<EmailJob>[] = [
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

  // Sent table columns
  const sentColumns: Column<EmailJob>[] = [
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

  // Stats
  const scheduledCount = scheduledData?.total ?? 0;
  const sentCount = sentData?.total ?? 0;
  const sendersCount = sendersData?.senders?.length ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Top Action Bar / Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Email Job Scheduler
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Automate high-volume email delivery with real-time rate limiting & tracking
          </p>
        </div>

        {/* Primary CTA: Compose New Email */}
        <Button
          onClick={() => setShowCompose(true)}
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          id="compose-btn"
          className="self-start sm:self-auto shadow-brand-500/20 shadow-lg"
        >
          Compose New Email
        </Button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 flex items-center gap-3.5 bg-surface-1/80 hover:border-white/20 transition-all">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white tracking-tight">{scheduledCount}</p>
            <p className="text-xs text-gray-400 font-medium">Scheduled Emails</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center gap-3.5 bg-surface-1/80 hover:border-white/20 transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white tracking-tight">{sentCount}</p>
            <p className="text-xs text-gray-400 font-medium">Delivered / Sent</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center gap-3.5 bg-surface-1/80 hover:border-white/20 transition-all">
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white tracking-tight">{sendersCount}</p>
            <p className="text-xs text-gray-400 font-medium">Sender Profiles</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center gap-3.5 bg-surface-1/80 hover:border-white/20 transition-all">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white tracking-tight">
              {scheduledCount + sentCount}
            </p>
            <p className="text-xs text-gray-400 font-medium">Total Processed</p>
          </div>
        </div>
      </div>

      {/* Main Section Card with Tabs */}
      <div className="card p-0 overflow-hidden border border-white/10 shadow-xl bg-surface-1/90">
        {/* Navigation Tabs & Controls Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/10 bg-surface-2/40">
          {/* Tabs: Scheduled Emails & Sent Emails */}
          <div className="flex items-center gap-2 bg-surface-1/80 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'scheduled'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 border border-brand-400/40'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
              id="tab-scheduled-btn"
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'scheduled' ? 'bg-white/20 text-white' : 'bg-surface-3 text-gray-400'
                }`}
              >
                {scheduledCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'sent'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 border border-brand-400/40'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
              id="tab-sent-btn"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Sent Emails</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'sent' ? 'bg-white/20 text-white' : 'bg-surface-3 text-gray-400'
                }`}
              >
                {sentCount}
              </span>
            </button>
          </div>

          {/* Search Bar & Refresh */}
          <div className="flex items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search leads, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9 pr-8 py-2 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </form>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                refetchScheduled();
                refetchSent();
              }}
              isLoading={isScheduledFetching || isSentFetching}
              title="Refresh table data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isScheduledFetching || isSentFetching ? 'animate-spin' : ''
                }`}
              />
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'scheduled' ? (
            <Table<EmailJob>
              columns={scheduledColumns}
              data={scheduledData?.emails ?? []}
              keyExtractor={(job) => job.id}
              isLoading={isScheduledLoading}
              page={scheduledPage}
              total={scheduledData?.total ?? 0}
              limit={scheduledData?.limit ?? 25}
              onPageChange={setScheduledPage}
              emptyState={
                <EmptyState
                  icon={<Clock className="w-8 h-8 text-brand-400" />}
                  title="No scheduled emails found"
                  description="You have no emails pending dispatch. Compose a new campaign to schedule emails."
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
          ) : (
            <Table<EmailJob>
              columns={sentColumns}
              data={sentData?.emails ?? []}
              keyExtractor={(job) => job.id}
              isLoading={isSentLoading}
              page={sentPage}
              total={sentData?.total ?? 0}
              limit={sentData?.limit ?? 25}
              onPageChange={setSentPage}
              emptyState={
                <EmptyState
                  icon={<CheckCircle className="w-8 h-8 text-emerald-400" />}
                  title={activeSearch ? 'No emails match your search' : 'No sent emails yet'}
                  description={
                    activeSearch
                      ? `No delivered emails matched "${activeSearch}". Try clearing your search.`
                      : 'Emails that have completed sending will automatically show up here with live status.'
                  }
                  action={
                    activeSearch ? (
                      <Button variant="secondary" size="sm" onClick={clearSearch}>
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
          )}
        </div>
      </div>

      {/* Compose New Email Modal */}
      <ComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        onSuccess={() => {
          setShowCompose(false);
          queryClient.invalidateQueries({ queryKey: ['emails'] });
          setActiveTab('scheduled');
        }}
        initialSenders={sendersData?.senders ?? []}
      />
    </div>
  );
}
