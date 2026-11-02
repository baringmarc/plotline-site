import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { LandingPage } from './LandingPage'
import { NotFoundPage, PrivacyPage, TermsPage } from './SimplePages'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
