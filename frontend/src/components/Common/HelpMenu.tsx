import { BookText, CircleHelp, Info, Keyboard } from "lucide-react"
import type { ReactNode } from "react"

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
import { useDevFixtures } from "@/hooks/useDevFixtures"

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "⌘ K", description: "Open global search" },
  { keys: "Esc", description: "Close dialogs and menus" },
]

export function HelpMenu({ trigger }: { trigger?: ReactNode }) {
  const { enabled, toggle } = useDevFixtures()

  return (
    <Dialog>
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
