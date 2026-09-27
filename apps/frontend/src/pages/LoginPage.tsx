import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { Mail, Zap, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (user && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const slackStatus = params.get('slack');
    const error = params.get('error');

    if (slackStatus === 'connected') {
      toast.success('Slack workspace connected successfully!');
    }
    if (error === 'google_auth_failed') {
      toast.error('Google sign-in was cancelled or failed. Please try again.');
    } else if (error === 'google_credentials_missing') {
      toast.error('Google OAuth credentials not configured in backend .env.');
    } else if (error) {
      toast.error('Authentication failed. Please try again.');
    }
  }, [params]);

  const features = [
    { icon: Mail, text: 'Precision batch scheduling with zero cron drift' },
    { icon: Zap, text: 'BullMQ-powered background delivery & crash resilience' },
    { icon: Shield, text: 'Distributed Redis rate limiting & atomic idempotency' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-surface-0 via-surface-1 to-surface-0 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-900/25 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-2xl mb-4 shadow-2xl shadow-brand-900/60 border border-brand-400/30">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <span>MailPulse</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              PRO
            </span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            High-Performance Email Scheduling & Delivery Engine
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl border border-white/10 bg-surface-1/80 backdrop-blur-xl">
          <div className="text-center mb-7">
            <h2 className="text-xl font-bold text-white tracking-tight">Welcome to MailPulse</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Sign in with your Google account to access your dashboard
            </p>
          </div>

          {/* Real Google OAuth Login Button */}
          <button
            type="button"
            onClick={authApi.loginWithGoogle}
            className="w-full flex items-center justify-center gap-3.5 bg-white text-gray-800 font-semibold py-3.5 px-6 rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95 shadow-lg shadow-black/30 hover:shadow-xl cursor-pointer"
            id="google-login-btn"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold text-center mb-4">
              Enterprise Grade Features
            </p>
            <ul className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-500/30">
                    <Icon className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                  <span className="text-xs text-gray-300 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6 font-medium">
          MailPulse · Powered by Express, BullMQ, Redis, PostgreSQL & React
        </p>
      </div>
    </div>
  );
}
