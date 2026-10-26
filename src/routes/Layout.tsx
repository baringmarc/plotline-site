import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'

export function Layout() {
  return (
    <>
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  )
}
