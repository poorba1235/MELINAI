import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Box, Button, Theme } from '@radix-ui/themes'
import { Suspense, lazy } from 'react'

import { ClientOnly } from '../components/ClientOnly'

const DevtoolsClient = lazy(() => import('../components/DevtoolsClient'))

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <Theme
      appearance="dark"
      accentColor="iris"
      grayColor="slate"
      panelBackground="solid"
      radius="small"
    >
      <Outlet />
      <ClientOnly>
        <Suspense fallback={null}>
          <DevtoolsClient />
        </Suspense>
      </ClientOnly>
    </Theme>
  )
}

function NotFound() {
  return (
    <Box className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <Box className="text-center">
        <h1 className="text-2xl font-semibold">Not Found</h1>
        <p className="text-sm opacity-80">That page doesn’t exist.</p>
      </Box>
      <Button asChild>
        <a href="/">Go home</a>
      </Button>
    </Box>
  )
}
