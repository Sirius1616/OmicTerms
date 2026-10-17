import { useNavigate } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
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
  Search,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Destination = {
  title: string
  path: string
  group: string
  icon: LucideIcon
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
    icon: Database,
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
    icon: Wrench,
  },
  {
    title: "Evidence Graph",
    path: "/evidence",
    group: "Research Workspace",
    icon: Network,
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
      setActiveIndex(0)
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [open])

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
      icon: LucideIcon
      run: () => void
    }> = matches.map((destination) => ({
      key: destination.path,
      title: destination.title,
      hint: destination.group,
      icon: destination.icon,
      run: () => navigate({ to: destination.path }),
    }))

    if (trimmed) {
      items.push({
        key: "search-documents",
        title: `Search data sources for “${trimmed}”`,
        hint: "Data Sources",
        icon: Search,
        run: () => navigate({ to: "/documents", search: { q: trimmed } }),
      })
    }

    return items
  }, [trimmed, navigate])

  useEffect(() => {
    setActiveIndex(0)
  }, [])

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
            {results.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No matches.
              </p>
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
