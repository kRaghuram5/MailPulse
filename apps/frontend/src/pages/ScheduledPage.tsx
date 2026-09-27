import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { emailsApi } from '../services/api';
import { Clock, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

export default function ScheduledPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['emails', 'scheduled', page],
    queryFn: () => emailsApi.scheduled(page, 50).then((r) => r.data),
    refetchInterval: 15_000,
  });

  if (error) {
    return (
      <div className="card text-center py-12 text-red-400">
        <p>Failed to load scheduled emails. Please try again.</p>
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
          <h1 className="text-2xl font-bold text-white">Scheduled Emails</h1>
          <p className="text-gray-400 text-sm mt-1">
            Emails pending send · {data?.total ?? 0} total
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

      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : data?.emails.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8 text-gray-500" />}
            title="No scheduled emails"
            description="Schedule an email campaign to see it here"
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
                    <th className="text-left pb-4 text-gray-400 font-medium">Scheduled Time</th>
                    <th className="text-left pb-4 text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.emails.map((job) => (
                    <tr key={job.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3.5 text-gray-200">{job.recipient}</td>
                      <td className="py-3.5 text-gray-400 max-w-[200px] truncate">
                        {job.subject}
                      </td>
                      <td className="py-3.5 text-gray-500 text-xs">
                        {job.sender?.displayName}
                      </td>
                      <td className="py-3.5 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(job.scheduledAt).toLocaleString()}
                      </td>
                      <td className="py-3.5">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total > data.limit && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  Page {page} · {data.total} total results
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
                    disabled={data.emails.length < data.limit}
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
