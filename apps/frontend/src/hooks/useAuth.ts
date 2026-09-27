import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/api';
import type { UserMe } from '../services/api';

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<UserMe>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
