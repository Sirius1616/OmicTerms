import { useRouterState } from "@tanstack/react-router"
import {
  BookText,
  CircleHelp,
  Info,
  Keyboard,
  LifeBuoy,
  Lightbulb,
} from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type HelpDocsLink, helpTopicForPath } from "@/content/help"
import { useDevFixtures } from "@/hooks/useDevFixtures"

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "⌘ K", description: "Open global search" },
  { keys: "Esc", description: "Close dialogs and menus" },
]

export function HelpMenu({ trigger }: { trigger?: ReactNode }) {
  const { enabled, toggle } = useDevFixtures()
  const router = useRouterState()
  const currentPath = router.location.pathname
  const topic = helpTopicForPath(currentPath)
  const [topicOpen, setTopicOpen] = useState(false)

  return (
    <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Help"
              className="text-muted-foreground"
            >
              <CircleHelp className="size-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-64">
          <DropdownMenuLabel>Help</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              data-testid="help-route-topic"
            >
              <Lightbulb />
              <span>
                <span className="block text-[13px] leading-tight font-medium">
                  {topic.title}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-tight">
                  {topic.summary}
                </span>
              </span>
            </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuItem asChild>
            <a
              href="https://github.com/Sirius1616/OmicTerms"
              target="_blank"
              rel="noreferrer"
            >
              <BookText />
              Documentation
            </a>
          </DropdownMenuItem>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Keyboard />
              Keyboard shortcuts
            </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuItem disabled>
            <Info />
            About OmicTerms
          </DropdownMenuItem>
          {import.meta.env.DEV ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Developer</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={enabled}
                onCheckedChange={() => toggle()}
              >
                Enable dev fixtures
              </DropdownMenuCheckboxItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent className="sm:max-w-md" data-testid="help-topic-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="size-4 text-muted-foreground" />
            {topic.title}
          </DialogTitle>
          <DialogDescription>{topic.summary}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          {topic.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-[13px] leading-relaxed">
              {paragraph}
            </p>
          ))}
          <DocsLinks links={topic.docs} />
        </div>
      </DialogContent>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts available throughout the app.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Docs-links only where the page really exists; missing pages render a
 * disabled item with an honest "on the way" hint (AC: disabled links).
 */
function DocsLinks({ links }: { links: HelpDocsLink[] }) {
  if (links.length === 0) return null
  return (
    <div className="mt-1 flex flex-col gap-1">
      {links.map((link) =>
        "pending" in link ? (
          <div
            key={link.label}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
          >
            <BookText className="size-3.5" />
            <span>{link.label}</span>
            <span className="rounded border border-border px-1.5 text-[10px]">
              docs coming with Story 61
            </span>
          </div>
        ) : (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[12px] text-primary underline-offset-2 hover:underline"
          >
            <BookText className="size-3.5" />
            {link.label}
          </a>
        ),
      )}
    </div>
  )
}
