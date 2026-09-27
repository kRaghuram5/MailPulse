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

export * from '../types';
import type {
  UserMe,
  Sender,
  ScheduleEmailRequest,
  ScheduleEmailResponse,
  EmailListResponse,
  SearchResponse,
} from '../types';
