export type EmailJobStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

export interface UserMe {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  slack: {
    connected: boolean;
    teamName?: string;
    teamId?: string;
  };
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
  status: EmailJobStatus;
  sentAt?: string;
  failedAt?: string;
  errorMessage?: string;
  createdAt: string;
  sender?: {
    email: string;
    displayName: string;
  };
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
