import {
  BookOpen,
  Database,
  FileBarChart,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Network,
  Plug,
  Route as RouteIcon,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type ItemGroup, Main } from "./Main"
import { User } from "./User"

const researchGroup: ItemGroup = {
  label: "Research",
  items: [
    { icon: LayoutDashboard, title: "Dashboard", path: "/" },
    { icon: FolderKanban, title: "Projects", path: "/projects" },
    { icon: Database, title: "Data Sources", path: "/documents" },
    { icon: Plug, title: "Integrations", path: "/integrations" },
    { icon: Wrench, title: "Analysis Tools", path: "/analysis-tools" },
    { icon: Network, title: "Evidence Graph", path: "/evidence" },
    { icon: FileBarChart, title: "Reports", path: "/reports" },
  ],
}

const academyGroup: ItemGroup = {
  label: "Academy",
  items: [
    { icon: GraduationCap, title: "Academy", path: "/academy" },
    { icon: RouteIcon, title: "Learning Path", path: "/academy/path" },
    { icon: BookOpen, title: "Concept Explorer", path: "/academy/concepts" },
    { icon: FlaskConical, title: "Interactive Labs", path: "/academy/labs" },
    { icon: TrendingUp, title: "My Progress", path: "/academy/progress" },
  ],
}

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const isAdmin = Boolean(
    (currentUser as { is_admin?: boolean } | undefined)?.is_admin,
  )

  const groups: ItemGroup[] = [researchGroup, academyGroup]

  if (isAdmin) {
    groups.push({
      label: "Admin",
      items: [{ icon: Users, title: "Admin", path: "/admin" }],
    })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
