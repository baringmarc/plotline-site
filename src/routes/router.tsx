import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { LandingPage } from './LandingPage'
import { NotFoundPage, PrivacyPage, RouteError, RouteLoading, TermsPage } from './SimplePages'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      // Lazy, so the landing page's first load doesn't carry the stack.
      {
        path: 'paddle-stack',
        lazy: () => import('../features/stack/StackPage').then((m) => ({ Component: m.StackPage })),
        hydrateFallbackElement: <RouteLoading />,
        errorElement: <RouteError />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
