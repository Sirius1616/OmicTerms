import { Link as RouterLink } from "@tanstack/react-router"
import {
  BookOpen,
  CircleHelp,
  FileBarChart,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Plug,
  Route as RouteIcon,
  Settings,
  Shield,
  TrendingUp,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { HelpMenu } from "@/components/Common/HelpMenu"
import { Logo } from "@/components/Common/Logo"
import {
  AnalysisGlyph,
  DataSourcesGlyph,
  GraphGlyph,
} from "@/components/Common/ScientificIcons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type ItemGroup, Main } from "./Main"
import { User } from "./User"

const researchGroup: ItemGroup = {
  label: "Research Workspace",
  items: [
    { icon: LayoutDashboard, title: "Home", path: "/" },
    { icon: FolderKanban, title: "Projects", path: "/projects" },
    { icon: DataSourcesGlyph, title: "Data Sources", path: "/documents" },
    { icon: Plug, title: "Integrations", path: "/integrations" },
    { icon: AnalysisGlyph, title: "Analysis Tools", path: "/analysis-tools" },
    { icon: GraphGlyph, title: "Evidence Graph", path: "/evidence" },
    { icon: FileBarChart, title: "Reports", path: "/reports" },
  ],
}

const academyGroup: ItemGroup = {
  label: "Learning & Academy",
  items: [
    { icon: GraduationCap, title: "OmicTerms Academy", path: "/academy" },
    { icon: RouteIcon, title: "Learning Path", path: "/academy/path" },
    { icon: BookOpen, title: "Concept Explorer", path: "/academy/concepts" },
    { icon: FlaskConical, title: "Interactive Labs", path: "/academy/labs" },
    { icon: TrendingUp, title: "My Progress", path: "/academy/progress" },
  ],
}

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()

  const isAdmin = Boolean(
    (currentUser as { is_admin?: boolean } | undefined)?.is_admin,
  )

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-1 px-4 py-6 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Logo variant="responsive" />
        <p className="px-0.5 text-[11px] leading-tight text-muted-foreground group-data-[collapsible=icon]:hidden">
          Multi-omics research workspace
        </p>
      </SidebarHeader>
      <SidebarContent>
        <Main groups={[researchGroup, academyGroup]} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {isAdmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Admin" asChild>
                <RouterLink to="/admin" onClick={handleMenuClick}>
                  <Shield />
                  <span>Admin</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" asChild>
              <RouterLink to="/settings" onClick={handleMenuClick}>
                <Settings />
                <span>Settings</span>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <HelpMenu
              trigger={
                <SidebarMenuButton aria-label="Help">
                  <CircleHelp />
                  <span>Help</span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
