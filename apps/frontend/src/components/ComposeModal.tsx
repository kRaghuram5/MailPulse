import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { emailsApi, sendersApi } from '../services/api';
import type { Sender, ScheduleEmailRequest } from '../services/api';
import toast from 'react-hot-toast';
import { X, Upload, AlertCircle } from 'lucide-react';
import Spinner from './ui/Spinner';
import { useQuery } from '@tanstack/react-query';

interface Props {
  senders: Sender[];
  onClose: () => void;
  onSuccess: () => void;
}

function parseEmailsFromText(text: string): { valid: string[]; invalid: string[] } {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = text.match(emailRegex) ?? [];
  const unique = [...new Set(found.map((e) => e.toLowerCase()))];

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of unique) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }

  return { valid, invalid };
}

export default function ComposeModal({ senders, onClose, onSuccess }: Props) {
  const [senderId, setSenderId] = useState(senders[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientText, setRecipientText] = useState('');
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delay, setDelay] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [showNewSender, setShowNewSender] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = { invalidateQueries: () => {} }; // placeholder

  const { data: sendersData, refetch: refetchSenders } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.list().then((r) => r.data),
  });

  const allSenders = sendersData?.senders ?? senders;

  const createSenderMutation = useMutation({
    mutationFn: () =>
      sendersApi.create({ email: newSenderEmail, displayName: newSenderName }),
    onSuccess: (res) => {
      setSenderId(res.data.sender.id);
      setShowNewSender(false);
      setNewSenderEmail('');
      setNewSenderName('');
      refetchSenders();
      toast.success('Sender created');
    },
    onError: () => toast.error('Failed to create sender'),
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: ScheduleEmailRequest) => emailsApi.schedule(data),
    onSuccess: (res) => {
      toast.success(`${res.data.scheduledCount} email(s) scheduled!`);
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to schedule emails');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { valid, invalid } = parseEmailsFromText(text);
      setRecipients(valid);
      setInvalidEmails(invalid);
      setRecipientText(valid.join('\n'));
    };
    reader.readAsText(file);
  };

  const handleRecipientTextChange = (text: string) => {
    setRecipientText(text);
    const { valid, invalid } = parseEmailsFromText(text);
    setRecipients(valid);
    setInvalidEmails(invalid);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId) return toast.error('Please select a sender');
    if (!subject.trim()) return toast.error('Subject is required');
    if (!body.trim()) return toast.error('Body is required');
    if (recipients.length === 0) return toast.error('At least one valid recipient required');
    if (!startTime) return toast.error('Start time is required');

    scheduleMutation.mutate({
      senderId,
      subject,
      body,
      recipients,
      startTime: new Date(startTime).toISOString(),
      delayBetweenEmailsMs: delay,
      hourlyLimit,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface-1 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Compose New Email</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Sender */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Sender</label>
            <div className="flex gap-2">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="input-field flex-1"
                required
              >
                <option value="">Select a sender...</option>
                {allSenders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} &lt;{s.email}&gt;
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSender(!showNewSender)}
                className="btn-secondary text-sm px-3"
              >
                + New
              </button>
            </div>
          </div>

          {/* New Sender Form */}
          {showNewSender && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-3 border border-white/10 animate-slide-up">
              <h3 className="text-sm font-medium text-gray-300">New Sender</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  className="input-field text-sm"
                />
                <input
                  type="text"
                  placeholder="Display Name"
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => createSenderMutation.mutate()}
                disabled={createSenderMutation.isPending || !newSenderEmail || !newSenderName}
                className="btn-primary text-sm"
              >
                {createSenderMutation.isPending ? <Spinner size="sm" /> : 'Create Sender'}
              </button>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your email subject..."
              className="input-field"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body..."
              rows={5}
              className="input-field resize-none"
              required
            />
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Recipients</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <textarea
              value={recipientText}
              onChange={(e) => handleRecipientTextChange(e.target.value)}
              placeholder="Paste emails (one per line or comma-separated) or upload CSV..."
              rows={4}
              className="input-field resize-none font-mono text-sm"
            />
            {recipients.length > 0 && (
              <p className="mt-1.5 text-xs text-green-400">
                ✓ Found {recipients.length} valid email address{recipients.length !== 1 ? 'es' : ''}
              </p>
            )}
            {invalidEmails.length > 0 && (
              <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-red-300 font-medium">
                    {invalidEmails.length} invalid address(es) will be skipped
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Delay Between Emails (ms)
              </label>
              <input
                type="number"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value) || 2000)}
                min={0}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Hourly Limit
              </label>
              <input
                type="number"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 200)}
                min={1}
                max={10000}
                className="input-field"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              {recipients.length > 0
                ? `${recipients.length} emails will be scheduled`
                : 'No recipients selected'}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduleMutation.isPending || recipients.length === 0}
                className="btn-primary flex items-center gap-2"
                id="schedule-submit-btn"
              >
                {scheduleMutation.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
