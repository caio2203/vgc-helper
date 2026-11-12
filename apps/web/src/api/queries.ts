import { queryOptions } from '@tanstack/react-query';
import { type DexSnapshot, type Manifest, manifestSchema } from '@vgc-helper/data';
import {
  authMethodsSchema,
  type SessionResponse,
  sessionResponseSchema,
  settingsSchema,
  teamSchema,
  teamSummarySchema,
  teamVersionSummarySchema,
} from '@vgc-helper/shared';
import { z } from 'zod';
import { ApiError, api, setCsrfToken } from './client';

/** The current session, or null when signed out. */
export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<SessionResponse | null> => {
    try {
      const session = await api('/auth/session', { schema: sessionResponseSchema });
      setCsrfToken(session.csrfToken);
      return session;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCsrfToken(null);
        return null;
      }
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
});

export const authMethodsQuery = queryOptions({
  queryKey: ['auth', 'methods'],
  queryFn: () => api('/auth/methods', { schema: authMethodsSchema }),
  staleTime: Number.POSITIVE_INFINITY,
});

export const settingsQuery = queryOptions({
  queryKey: ['settings'],
  queryFn: () => api('/settings', { schema: settingsSchema }),
});

export const manifestQuery = queryOptions({
  queryKey: ['snapshots', 'manifest'],
  queryFn: (): Promise<Manifest> => api('/snapshots/manifest', { schema: manifestSchema }),
  staleTime: 10 * 60 * 1000,
});

/** The dex is large and already validated by the API; it is not re-parsed in the browser. */
export const dexQuery = (gameId: string, regulationId: string) =>
  queryOptions({
    queryKey: ['snapshots', gameId, regulationId, 'dex'],
    queryFn: (): Promise<DexSnapshot> => api(`/snapshots/${gameId}/${regulationId}/dex`),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const teamsQuery = queryOptions({
  queryKey: ['teams'],
  queryFn: () => api('/teams', { schema: z.array(teamSummarySchema) }),
});

export const teamQuery = (id: string) =>
  queryOptions({
    queryKey: ['teams', id],
    queryFn: () => api(`/teams/${id}`, { schema: teamSchema }),
  });

export const teamVersionsQuery = (id: string) =>
  queryOptions({
    queryKey: ['teams', id, 'versions'],
    queryFn: () => api(`/teams/${id}/versions`, { schema: z.array(teamVersionSummarySchema) }),
  });
