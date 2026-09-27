import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailsApi, sendersApi } from '../services/api';
import type { Sender, ScheduleEmailRequest } from '../types';
import toast from 'react-hot-toast';
import { Upload, AlertCircle, CheckCircle2, Plus, FileText, Calendar, Clock, Gauge } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSenders?: Sender[];
}

function parseEmailsFromText(text: string): { valid: string[]; invalid: string[] } {
  // Extract all potential email tokens
  const rawTokens = text.split(/[\r\n,;]+/).map((t) => t.trim()).filter(Boolean);
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  const validSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const token of rawTokens) {
    // Strip surrounding quotes or chevrons if any (e.g. "john" <john@example.com>)
    const extracted = token.match(/<([^>]+)>/)?.[1] || token.replace(/["']/g, '');
    const cleanEmail = extracted.toLowerCase().trim();

    if (emailRegex.test(cleanEmail)) {
      validSet.add(cleanEmail);
    } else if (cleanEmail.length > 0) {
      invalidSet.add(token);
    }
  }

  return {
    valid: Array.from(validSet),
    invalid: Array.from(invalidSet),
  };
}

// Format local datetime for datetime-local input
function getDefaultStartTime(): string {
  const now = new Date(Date.now() + 60 * 1000); // 1 minute from now
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function ComposeModal({ isOpen, onClose, onSuccess, initialSenders = [] }: Props) {
  const queryClient = useQueryClient();

  const { data: sendersData, refetch: refetchSenders } = useQuery({
    queryKey: ['senders'],
    queryFn: () => sendersApi.list().then((r) => r.data),
    enabled: isOpen,
  });

  const allSenders = sendersData?.senders ?? initialSenders;

  const [senderId, setSenderId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientText, setRecipientText] = useState<string>('');
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<string>(getDefaultStartTime());
  const [delayBetweenEmailsMs, setDelayBetweenEmailsMs] = useState<number>(2000);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // New sender state
  const [showNewSender, setShowNewSender] = useState<boolean>(false);
  const [newSenderEmail, setNewSenderEmail] = useState<string>('');
  const [newSenderName, setNewSenderName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first sender
  useEffect(() => {
    if (allSenders.length > 0 && !senderId) {
      setSenderId(allSenders[0].id);
    }
  }, [allSenders, senderId]);

  const createSenderMutation = useMutation({
    mutationFn: () =>
      sendersApi.create({ email: newSenderEmail.trim(), displayName: newSenderName.trim() }),
    onSuccess: (res) => {
      setSenderId(res.data.sender.id);
      setShowNewSender(false);
      setNewSenderEmail('');
      setNewSenderName('');
      refetchSenders();
      toast.success(`Sender "${res.data.sender.displayName}" added successfully`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create sender');
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: ScheduleEmailRequest) => emailsApi.schedule(data),
    onSuccess: (res) => {
      toast.success(res.data.message || `${res.data.scheduledCount} email(s) scheduled!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      // Reset form
      setSubject('');
      setBody('');
      setRecipients([]);
      setRecipientText('');
      setInvalidEmails([]);
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to schedule emails';
      toast.error(msg);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { valid, invalid } = parseEmailsFromText(content);
      setRecipients(valid);
      setInvalidEmails(invalid);
      setRecipientText(valid.join('\n'));
      toast.success(`Loaded ${valid.length} valid email leads from ${file.name}`);
    };
    reader.onerror = () => {
      toast.error('Failed to read file. Please ensure it is a valid text/CSV file.');
    };
    reader.readAsText(file);
    // Reset file input so re-uploading same file triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTextChange = (text: string) => {
    setRecipientText(text);
    const { valid, invalid } = parseEmailsFromText(text);
    setRecipients(valid);
    setInvalidEmails(invalid);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderId) {
      toast.error('Please choose or create a sender identity');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter an email body');
      return;
    }
    if (recipients.length === 0) {
      toast.error('Please provide at least one valid recipient lead');
      return;
    }
    if (!startTime) {
      toast.error('Please select when scheduling begins (start time)');
      return;
    }

    const isoStartTime = new Date(startTime).toISOString();

    scheduleMutation.mutate({
      senderId,
      subject: subject.trim(),
      body: body.trim(),
      recipients,
      startTime: isoStartTime,
      delayBetweenEmailsMs: Math.max(0, delayBetweenEmailsMs),
      hourlyLimit: Math.max(1, hourlyLimit),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose New Email Campaign"
      description="Configure email details, lead recipients, and rate-limited scheduling"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sender Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-200">Sender Identity</label>
            <button
              type="button"
              onClick={() => setShowNewSender(!showNewSender)}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {showNewSender ? 'Cancel' : 'Add New Sender'}
            </button>
          </div>

          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="input-field text-sm font-medium"
            required
          >
            {allSenders.length === 0 ? (
              <option value="">No senders found. Please add a sender.</option>
            ) : (
              allSenders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} &lt;{s.email}&gt;
                </option>
              ))
            )}
          </select>

          {/* Inline New Sender Card */}
          {showNewSender && (
            <div className="bg-surface-2 border border-brand-500/30 rounded-xl p-4 space-y-3 animate-slide-up">
              <h4 className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                Create Sender Profile
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Sender Name (e.g. Sales Team)"
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                  className="input-field text-sm"
                />
                <input
                  type="email"
                  placeholder="sender@domain.com"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewSender(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={createSenderMutation.isPending}
                  disabled={!newSenderName.trim() || !newSenderEmail.trim()}
                  onClick={() => createSenderMutation.mutate()}
                >
                  Save Sender
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <Input
            label="Subject"
            type="text"
            placeholder="e.g. Exclusive product update for you"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-200">Email Body</label>
          <textarea
            rows={5}
            placeholder="Write your email copy here... HTML or plain text is supported."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="input-field resize-none text-sm leading-relaxed"
            required
          />
        </div>

        {/* Recipients & File Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-200">
              Email Leads (CSV / Text / Paste)
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium px-2.5 py-1 rounded-md bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV / Leads File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <textarea
            rows={4}
            placeholder="Paste lead email addresses (comma, semicolon, or newline separated) or upload a CSV file above..."
            value={recipientText}
            onChange={(e) => handleTextChange(e.target.value)}
            className="input-field font-mono text-xs resize-none"
          />

          {/* Lead parsing feedback */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {recipients.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {recipients.length} email {recipients.length === 1 ? 'address' : 'addresses'} detected
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                0 leads detected — paste emails or upload a CSV
              </span>
            )}

            {invalidEmails.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                {invalidEmails.length} invalid entry skipped
              </span>
            )}
          </div>
        </div>

        {/* Scheduling Controls */}
        <div className="bg-surface-2/60 border border-white/5 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            Scheduling & Rate Limiting
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Start Time */}
            <div>
              <Input
                label="Start Time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
              <span className="text-[11px] text-gray-500 mt-1 block">When dispatch begins</span>
            </div>

            {/* Delay between emails */}
            <div>
              <Input
                label="Delay Between Emails (ms)"
                type="number"
                min={0}
                step={500}
                value={delayBetweenEmailsMs}
                onChange={(e) => setDelayBetweenEmailsMs(Number(e.target.value) || 0)}
                required
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                {(delayBetweenEmailsMs / 1000).toFixed(1)}s delay per email
              </span>
            </div>

            {/* Hourly Limit */}
            <div>
              <Input
                label="Hourly Limit"
                type="number"
                min={1}
                max={10000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value) || 1)}
                required
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Max emails/hour per sender
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-xs text-gray-400">
            {recipients.length > 0
              ? `Ready to schedule ${recipients.length} outgoing email${recipients.length !== 1 ? 's' : ''}`
              : 'Enter leads to schedule'}
          </span>

          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={scheduleMutation.isPending}
              disabled={recipients.length === 0 || !subject.trim() || !body.trim()}
              id="schedule-submit-btn"
            >
              Schedule Campaign
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
