import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Mail, Clock, CheckCircle, LogOut, Slack, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      queryClient.clear();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleSlack = async () => {
    if (user?.slack?.connected) {
      try {
        await authApi.disconnectSlack();
        toast.success('Slack disconnected');
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      } catch {
        toast.error('Failed to disconnect Slack');
      }
    } else {
      authApi.connectSlack();
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Mail },
    { to: '/scheduled', label: 'Scheduled', icon: Clock },
    { to: '/sent', label: 'Sent', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-0 text-gray-100">
      {/* Top Header */}
      <header className="glass border-b border-white/10 sticky top-0 z-40 bg-surface-1/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand-900/40">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-brand-200 to-brand-400 bg-clip-text text-transparent">
              MailPulse
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 bg-surface-2/60 border border-white/5 p-1 rounded-xl">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User Profile & Actions Header Area */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Auxiliary Tools: Slack & Bull Board */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={handleSlack}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                  user?.slack?.connected
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-white/10 bg-surface-2 text-gray-400 hover:bg-surface-3'
                }`}
                title={user?.slack?.connected ? `Connected: ${user.slack?.teamName}` : 'Connect Slack'}
              >
                <Slack className="w-3.5 h-3.5" />
                {user?.slack?.connected ? user.slack?.teamName : 'Slack'}
              </button>

              <a
                href="/admin/queues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 border border-white/10 bg-surface-2 hover:bg-surface-3 transition-all duration-200"
                title="BullMQ Queue Dashboard"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Queues
              </a>
            </div>

            {/* User Profile info: Avatar, Name, Email */}
            {user && (
              <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-white/10">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border-2 border-brand-500/40 shadow-sm object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-sm font-semibold text-white shadow-sm border border-brand-400/30">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-gray-100 leading-tight">
                    {user.name}
                  </span>
                  <span className="text-xs text-gray-400 leading-tight truncate max-w-[140px] sm:max-w-[180px]">
                    {user.email}
                  </span>
                </div>
              </div>
            )}

            {/* Logout Option */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-300 hover:text-red-400 bg-surface-2 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-all duration-200 shadow-sm"
              title="Sign out of your account"
              id="logout-btn"
            >
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
