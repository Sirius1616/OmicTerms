import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import ErrorComponent from "@/components/Common/ErrorComponent"
import NotFound from "@/components/Common/NotFound"

const isDev = import.meta.env.DEV

export const Route = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      {isDev ? (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </>
      ) : null}
    </>
  ),
  notFoundComponent: () => <NotFound />,
  errorComponent: () => <ErrorComponent />,
})
