import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from './api';
import type { WebUser } from './types';

interface MeResponse {
  user: WebUser | null;
}

interface AuthContextValue {
  user: WebUser | null;
  isLoading: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  login: (input: Record<string, unknown>) => Promise<WebUser>;
  register: (input: Record<string, unknown>) => Promise<WebUser>;
  logout: () => Promise<void>;
  changePassword: (input: Record<string, unknown>) => Promise<WebUser>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/auth/me'),
    staleTime: 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => api<{ user: WebUser }>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (data) => {
      queryClient.setQueryData<MeResponse>(['me'], { user: data.user });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ user: WebUser }>('/auth/register', { method: 'POST', body: input }),
    onSuccess: (data) => {
      queryClient.setQueryData<MeResponse>(['me'], { user: data.user });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api<null>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData<MeResponse>(['me'], { user: null });
      queryClient.removeQueries({ queryKey: ['admin'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ user: WebUser }>('/auth/change-password', { method: 'POST', body: input }),
    onSuccess: (data) => {
      queryClient.setQueryData<MeResponse>(['me'], { user: data.user });
    },
  });

  const login = useCallback(
    async (input: Record<string, unknown>) => {
      const result = await loginMutation.mutateAsync(input);
      return result.user;
    },
    [loginMutation],
  );

  const register = useCallback(
    async (input: Record<string, unknown>) => {
      const result = await registerMutation.mutateAsync(input);
      return result.user;
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      if (!(error instanceof ApiClientError)) throw error;
      queryClient.setQueryData<MeResponse>(['me'], { user: null });
    }
  }, [logoutMutation, queryClient]);

  const changePassword = useCallback(
    async (input: Record<string, unknown>) => {
      const result = await changePasswordMutation.mutateAsync(input);
      return result.user;
    },
    [changePasswordMutation],
  );

  const refreshMe = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data?.user ?? null,
      isLoading: meQuery.isLoading,
      isEditor: meQuery.data?.user?.role === 'editor' || meQuery.data?.user?.role === 'admin',
      isAdmin: meQuery.data?.user?.role === 'admin',
      login,
      register,
      logout,
      changePassword,
      refreshMe,
    }),
    [meQuery.data, meQuery.isLoading, login, register, logout, changePassword, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return context;
}
