import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendersApi, emailsApi } from '../services/api';
import type { Sender, ScheduleEmailRequest } from '../services/api';
import toast from 'react-hot-toast';
import { Upload, Plus, Mail, Clock, Zap, Users } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import ComposeModal from '../components/ComposeModal';

export default function DashboardPage() {
  const [showCompose, setShowCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.list().then((r) => r.data),
  });

  const { data: scheduledData } = useQuery({
    queryKey: ['emails', 'scheduled'],
    queryFn: () => emailsApi.scheduled(1, 5).then((r) => r.data),
    refetchInterval: 10_000,
  });

  const { data: sentData } = useQuery({
    queryKey: ['emails', 'sent'],
    queryFn: () => emailsApi.sent(1, 5).then((r) => r.data),
    refetchInterval: 10_000,
  });

  const stats = [
    {
      label: 'Scheduled',
      value: scheduledData?.total ?? 0,
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Sent',
      value: sentData?.emails.filter((e) => e.status === 'SENT').length ?? 0,
      icon: Mail,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Senders',
      value: sendersData?.senders.length ?? 0,
      icon: Users,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      label: 'Failed',
      value: sentData?.emails.filter((e) => e.status === 'FAILED').length ?? 0,
      icon: Zap,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Email Scheduler
          </h1>
          <p className="text-gray-400 mt-1">
            Schedule, track, and manage your email campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="btn-primary flex items-center gap-2"
          id="compose-btn"
        >
          <Plus className="w-4 h-4" />
          Compose New Email
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Scheduled */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Scheduled</h2>
          <a href="/scheduled" className="text-brand-400 text-sm hover:text-brand-300 transition-colors">
            View all →
          </a>
        </div>
        {scheduledData?.emails.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">No scheduled emails</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left pb-3 text-gray-400 font-medium">Recipient</th>
                  <th className="text-left pb-3 text-gray-400 font-medium">Subject</th>
                  <th className="text-left pb-3 text-gray-400 font-medium">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scheduledData?.emails.map((job) => (
                  <tr key={job.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-gray-200">{job.recipient}</td>
                    <td className="py-3 text-gray-400 truncate max-w-[200px]">{job.subject}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(job.scheduledAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          senders={sendersData?.senders ?? []}
          onClose={() => setShowCompose(false)}
          onSuccess={() => {
            setShowCompose(false);
            queryClient.invalidateQueries({ queryKey: ['emails'] });
          }}
        />
      )}
    </div>
  );
}
