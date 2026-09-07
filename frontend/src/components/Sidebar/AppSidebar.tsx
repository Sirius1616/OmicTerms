import { FileText, Home, Users } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { ChromosomeBars, LabReadout } from "@/components/Common/GenomicsMotif"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Dashboard", path: "/" },
  { icon: FileText, title: "Documents", path: "/documents" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const isAdmin = Boolean(
    (currentUser as { is_admin?: boolean } | undefined)?.is_admin,
  )

  const items = isAdmin
    ? [...baseItems, { icon: Users, title: "Admin", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <ChromosomeBars className="h-10 border-t border-border/40 pt-2" />
          <LabReadout className="justify-center px-4 py-2" />
        </div>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
