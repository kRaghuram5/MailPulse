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
      navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleSlack = async () => {
    if (user?.slack.connected) {
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              Outbox Labs
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Slack */}
            <button
              onClick={handleSlack}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                user?.slack.connected
                  ? 'border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20'
                  : 'border-white/10 bg-surface-3 text-gray-400 hover:bg-surface-4'
              }`}
              title={user?.slack.connected ? `Connected to ${user.slack.teamName}` : 'Connect Slack'}
            >
              <Slack className="w-3.5 h-3.5" />
              {user?.slack.connected ? user.slack.teamName : 'Connect Slack'}
            </button>

            {/* Bull Board link */}
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-surface-3 transition-all duration-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Queues
            </a>

            {/* User Avatar */}
            {user && (
              <div className="flex items-center gap-2">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border-2 border-brand-500/40"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-semibold">
                    {user.name[0]}
                  </div>
                )}
                <div className="hidden lg:block">
                  <p className="text-sm font-medium text-gray-100">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
