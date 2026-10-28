import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import ErrorComponent from "@/components/Common/ErrorComponent"
import NotFound from "@/components/Common/NotFound"

const isDev = import.meta.env.DEV

/**
 * Devtools are dev-only AND opt-in (`omiterms:devtools` = "on"): the floating
 * router-devtools toggle is a fixed-position element that otherwise intercepts
 * clicks near the bottom of the viewport (menus, dialogs).
 */
function devtoolsEnabled(): boolean {
  return isDev && localStorage.getItem("omiterms:devtools") === "on"
}

export const Route = createRootRoute({
  component: () => {
    const showDevtools = devtoolsEnabled()
    return (
      <>
        <HeadContent />
        <Outlet />
        {showDevtools ? (
          <>
            <TanStackRouterDevtools position="bottom-right" />
            <ReactQueryDevtools initialIsOpen={false} />
          </>
        ) : null}
      </>
    )
  },
  notFoundComponent: () => <NotFound />,
  errorComponent: () => <ErrorComponent />,
})
