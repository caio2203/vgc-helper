import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { loginErrorSchema } from '@vgc-helper/shared';
import { z } from 'zod';
import { sessionQuery } from './api/queries';
import { HomePage } from './routes/HomePage';
import { LoginPage } from './routes/LoginPage';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ error: loginErrorSchema.optional().catch(undefined) }),
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(sessionQuery)) throw redirect({ to: '/' });
  },
  component: function Login() {
    const { error } = loginRoute.useSearch();
    return <LoginPage error={error} />;
  },
});

/** Everything under this route needs a session. Signed-out visitors only ever see /login. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session) throw redirect({ to: '/login' });
    return { session };
  },
  component: Outlet,
});

const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/',
  component: function Home() {
    const { session } = homeRoute.useRouteContext();
    return <HomePage session={session} />;
  },
});

const routeTree = rootRoute.addChildren([loginRoute, authedRoute.addChildren([homeRoute])]);

export function makeRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: false });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}
