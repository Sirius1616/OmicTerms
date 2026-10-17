import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type Item = {
  icon: LucideIcon
  title: string
  path: string
}

export type ItemGroup = {
  label: string
  items: Item[]
}

interface MainProps {
  groups: ItemGroup[]
}

const activeButtonClass =
  "relative data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:-start-2 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary"

function isPathMatch(currentPath: string, path: string) {
  if (path === "/") {
    return currentPath === "/"
  }
  return currentPath === path || currentPath.startsWith(`${path}/`)
}

export function Main({ groups }: MainProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const allItems = groups.flatMap((group) => group.items)
  const activeItem = allItems.reduce<Item | null>((best, item) => {
    if (!isPathMatch(currentPath, item.path)) {
      return best
    }
    if (!best || item.path.length > best.path.length) {
      return item
    }
    return best
  }, null)

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="uppercase tracking-wide">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item === activeItem}
                    className={activeButtonClass}
                    asChild
                  >
                    <RouterLink to={item.path} onClick={handleMenuClick}>
                      <item.icon />
                      <span>{item.title}</span>
                    </RouterLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
