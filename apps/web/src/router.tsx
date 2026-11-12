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
import { AboutPage } from './about/AboutPage';
import { AdminPage } from './admin/AdminPage';
import { sessionQuery } from './api/queries';
import { BuilderPage } from './builder/BuilderPage';
import { CalcPage } from './calc/CalcPage';
import { WhatsNewPage } from './changes/WhatsNewPage';
import { AppShell } from './components/AppShell';
import { useAppearance } from './lib/theme';
import { PreviewPage } from './preview/PreviewPage';
import { LoginPage } from './routes/LoginPage';
import { SettingsPage } from './settings/SettingsPage';
import { TeamsPage } from './teams/TeamsPage';

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
  component: function Authed() {
    const { session } = authedRoute.useRouteContext();
    useAppearance(true);
    return (
      <AppShell session={session}>
        <Outlet />
      </AppShell>
    );
  },
});

const builderRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/',
  component: () => <BuilderPage />,
});

const teamsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/teams',
  component: TeamsPage,
});

const teamRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/teams/$teamId',
  component: function Team() {
    const { teamId } = teamRoute.useParams();
    return <BuilderPage teamId={teamId} />;
  },
});

const calcRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/calc',
  component: CalcPage,
});

const previewRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/preview',
  component: PreviewPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/settings',
  component: SettingsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/admin',
  component: AdminPage,
});

const whatsNewRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/whats-new',
  component: WhatsNewPage,
});

const aboutRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/about',
  component: AboutPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([
    builderRoute,
    teamsRoute,
    teamRoute,
    calcRoute,
    previewRoute,
    settingsRoute,
    adminRoute,
    whatsNewRoute,
    aboutRoute,
  ]),
]);

export function makeRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: false });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}
