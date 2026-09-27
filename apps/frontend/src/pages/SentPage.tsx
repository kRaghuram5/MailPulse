import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { emailsApi } from '../services/api';
import { CheckCircle, Search, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

export default function SentPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['emails', 'sent', page, activeSearch],
    queryFn: async () => {
      if (activeSearch) {
        const res = await emailsApi.search(activeSearch, page);
        return {
          emails: res.data.results as any[],
          total: res.data.total,
          page: res.data.page,
          limit: res.data.limit,
          fallback: res.data.fallback,
        };
      }
      return emailsApi.sent(page, 50).then((r) => r.data);
    },
    refetchInterval: activeSearch ? undefined : 15_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

  if (error) {
    return (
      <div className="card text-center py-12 text-red-400">
        <p>Failed to load emails. Please try again.</p>
        <button onClick={() => refetch()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sent Emails</h1>
          <p className="text-gray-400 text-sm mt-1">
            Sent and failed emails · {data?.total ?? 0} total
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by subject, recipient, or body..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <button type="submit" className="btn-primary">Search</button>
        {activeSearch && (
          <button
            type="button"
            onClick={() => { setActiveSearch(''); setSearchQuery(''); }}
            className="btn-secondary"
          >
            Clear
          </button>
        )}
      </form>

      {activeSearch && (
        <p className="text-sm text-gray-400">
          Searching for: <span className="text-brand-300">"{activeSearch}"</span>
          {data?.fallback && (
            <span className="ml-2 text-xs text-yellow-500">(fallback: Elasticsearch unavailable)</span>
          )}
        </p>
      )}

      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : data?.emails.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-8 h-8 text-gray-500" />}
            title="No sent emails"
            description="Emails you've sent will appear here"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left pb-4 text-gray-400 font-medium">Recipient</th>
                    <th className="text-left pb-4 text-gray-400 font-medium">Subject</th>
                    <th className="text-left pb-4 text-gray-400 font-medium">Sender</th>
                    <th className="text-left pb-4 text-gray-400 font-medium">Sent Time</th>
                    <th className="text-left pb-4 text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.emails.map((job: any) => (
                    <tr key={job.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 text-gray-200">{job.recipient}</td>
                      <td className="py-3.5 text-gray-400 max-w-[200px] truncate">
                        {job.subject}
                      </td>
                      <td className="py-3.5 text-gray-500 text-xs">
                        {job.sender?.displayName || job.senderEmail || '—'}
                      </td>
                      <td className="py-3.5 text-gray-400 text-xs whitespace-nowrap">
                        {job.sentAt ? new Date(job.sentAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3.5">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(data?.total ?? 0) > (data?.limit ?? 50) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  Page {page} · {data?.total} total results
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(data?.emails.length ?? 0) < (data?.limit ?? 50)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
