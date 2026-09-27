import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

// ─── Auth ───────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => api.get<UserMe>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  loginWithGoogle: () => { window.location.href = '/api/auth/google'; },
  connectSlack: () => { window.location.href = '/api/auth/slack'; },
  disconnectSlack: () => api.post('/auth/slack/disconnect'),
};

// ─── Senders ─────────────────────────────────────────────────────────────────

export const sendersApi = {
  list: () => api.get<{ senders: Sender[] }>('/senders'),
  create: (data: { email: string; displayName: string }) =>
    api.post<{ sender: Sender }>('/senders', data),
};

// ─── Emails ──────────────────────────────────────────────────────────────────

export const emailsApi = {
  schedule: (data: ScheduleEmailRequest) =>
    api.post<ScheduleEmailResponse>('/emails/schedule', data),
  scheduled: (page = 1, limit = 50) =>
    api.get<EmailListResponse>(`/emails/scheduled?page=${page}&limit=${limit}`),
  sent: (page = 1, limit = 50) =>
    api.get<EmailListResponse>(`/emails/sent?page=${page}&limit=${limit}`),
  search: (q: string, page = 1) =>
    api.get<SearchResponse>(`/emails/search?q=${encodeURIComponent(q)}&page=${page}`),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserMe {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  slack: { connected: boolean; teamName?: string; teamId?: string };
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface EmailJob {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  sentAt?: string;
  failedAt?: string;
  errorMessage?: string;
  createdAt: string;
  sender?: { email: string; displayName: string };
}

export interface ScheduleEmailRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export interface ScheduleEmailResponse {
  message: string;
  scheduledCount: number;
  skippedDuplicates: number;
  jobIds: string[];
}

export interface EmailListResponse {
  emails: EmailJob[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchResponse {
  results: EmailJob[];
  total: number;
  page: number;
  limit: number;
  fallback?: boolean;
}
