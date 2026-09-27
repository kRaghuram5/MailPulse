import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/api';
import type { UserMe } from '../types';

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<UserMe | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await authApi.me();
        // Ensure response is actually a valid user object, not an HTML string from SPA rewrite
        if (res.data && typeof res.data === 'object' && typeof res.data.id === 'string') {
          return res.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && typeof user === 'object' && !!user.id,
    error,
  };
}
