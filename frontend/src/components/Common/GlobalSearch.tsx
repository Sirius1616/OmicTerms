import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  BookOpen,
  FileBarChart,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Plug,
  Route as RouteIcon,
  Search,
  TrendingUp,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AnalysisGlyph,
  DataSourcesGlyph,
  FindingGlyph,
  GraphGlyph,
  type IconComponent,
} from "@/components/Common/ScientificIcons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { documentsApi } from "@/services/documents"
import { hierarchyApi } from "@/services/hierarchy"

type Destination = {
  title: string
  path: string
  group: string
  icon: IconComponent
}

const DESTINATIONS: Destination[] = [
  {
    title: "Home",
    path: "/",
    group: "Research Workspace",
    icon: LayoutDashboard,
  },
  {
    title: "Projects",
    path: "/projects",
    group: "Research Workspace",
    icon: FolderKanban,
  },
  {
    title: "Data Sources",
    path: "/documents",
    group: "Research Workspace",
    icon: DataSourcesGlyph,
  },
  {
    title: "Findings",
    path: "/findings",
    group: "Research Workspace",
    icon: FindingGlyph,
  },
  {
    title: "Integrations",
    path: "/integrations",
    group: "Research Workspace",
    icon: Plug,
  },
  {
    title: "Analysis Tools",
    path: "/analysis-tools",
    group: "Research Workspace",
    icon: AnalysisGlyph,
  },
  {
    title: "Evidence Graph",
    path: "/evidence",
    group: "Research Workspace",
    icon: GraphGlyph,
  },
  {
    title: "Reports",
    path: "/reports",
    group: "Research Workspace",
    icon: FileBarChart,
  },
  {
    title: "OmicTerms Academy",
    path: "/academy",
    group: "Learning & Academy",
    icon: GraduationCap,
  },
  {
    title: "Learning Path",
    path: "/academy/path",
    group: "Learning & Academy",
    icon: RouteIcon,
  },
  {
    title: "Concept Explorer",
    path: "/academy/concepts",
    group: "Learning & Academy",
    icon: BookOpen,
  },
  {
    title: "Interactive Labs",
    path: "/academy/labs",
    group: "Learning & Academy",
    icon: FlaskConical,
  },
  {
    title: "My Progress",
    path: "/academy/progress",
    group: "Learning & Academy",
    icon: TrendingUp,
  },
]

export function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setDebounced("")
      setActiveIndex(0)
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [open])
  // Story 11 — 250 ms debounce so a typing pause issues at most one
  // document-search request. Selection resets when the query settles.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(query.trim())
      setActiveIndex(0)
    }, 250)
    return () => window.clearTimeout(id)
  }, [query])

  const searchReady = debounced.length >= 2

  const documentsQuery = useQuery({
    queryKey: ["globalSearchDocuments", debounced],
    queryFn: () =>
      documentsApi.listDocuments({ search: debounced, limit: 100 }),
    enabled: open && searchReady,
    staleTime: 5000,
  })

  const projectsQuery = useQuery({
    queryKey: ["globalSearchProjects", debounced],
    queryFn: () => hierarchyApi.listProjectsTree(),
    enabled: open && searchReady,
    staleTime: 5000,
  })

  const trimmed = query.trim()

  const results = useMemo(() => {
    const lower = trimmed.toLowerCase()
    const matches = lower
      ? DESTINATIONS.filter((destination) =>
          destination.title.toLowerCase().includes(lower),
        )
      : DESTINATIONS

    const items: Array<{
      key: string
      title: string
      hint: string
      icon: IconComponent
      run: () => void
    }> = matches.map((destination) => ({
      key: destination.path,
      title: destination.title,
      hint: destination.group,
      icon: destination.icon,
      run: () => navigate({ to: destination.path }),
    }))

    if (searchReady) {
      const documentMatches = documentsQuery.data?.data ?? []
      for (const document of documentMatches) {
        items.push({
          key: `document:${document.id}`,
          title: document.filename || document.file_url,
          hint: "Data Sources",
          icon: DataSourcesGlyph,
          run: () =>
            navigate({
              to: "/documents/$documentId",
              params: { documentId: document.id },
            }),
        })
      }
      const projectMatches = (projectsQuery.data?.data ?? []).filter(
        (project) =>
          project.name.toLowerCase().includes(debounced.toLowerCase()),
      )
      for (const project of projectMatches) {
        items.push({
          key: `project:${project.id}`,
          title: project.name,
          hint: "Projects",
          icon: FolderKanban,
          run: () =>
            navigate({
              to: "/projects/$projectId",
              params: { projectId: project.id },
            }),
        })
      }
    }

    return items
  }, [
    trimmed,
    searchReady,
    debounced,
    documentsQuery.data,
    projectsQuery.data,
    navigate,
  ])

  const runItem = (index: number) => {
    const item = results[index]
    if (!item) return
    item.run()
    setOpen(false)
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) =>
        results.length === 0 ? 0 : (current + 1) % results.length,
      )
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) =>
        results.length === 0
          ? 0
          : (current - 1 + results.length) % results.length,
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      runItem(activeIndex)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-9 justify-center gap-2 px-0 text-muted-foreground sm:w-64 sm:justify-start sm:px-3 xl:w-80"
        onClick={() => setOpen(true)}
        aria-label="Open global search"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Global search</DialogTitle>
          <DialogDescription className="sr-only">
            Search pages and data sources across OmicTerms.
          </DialogDescription>
          <div className="border-b p-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages and data sources…"
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2" role="listbox">
            {searchReady ? (
              <p
                className="px-2 pb-1 text-[11px] text-muted-foreground"
                data-testid="search-scope-note"
              >
                Searching document filenames (server) and projects (locally).
                Findings, genes, and samples arrive with the evidence graph era
                (M3).
              </p>
            ) : null}
            {results.length === 0 ? (
              searchReady && documentsQuery.isPending ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Searching data sources…
                </p>
              ) : searchReady && documentsQuery.isError ? (
                <p
                  className="px-2 py-6 text-center text-sm text-destructive"
                  data-testid="search-error"
                >
                  Document search failed — retry by editing the query.
                </p>
              ) : (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No matches.
                </p>
              )
            ) : (
              results.map((item, index) => (
                <div key={item.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runItem(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
