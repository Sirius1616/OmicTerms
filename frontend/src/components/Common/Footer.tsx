import { ExternalLink } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <p>OmicTerms © {currentYear} · From data to discovery</p>
        <a
          href="https://github.com/Sirius1616/OmicTerms"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-4" />
          Source &amp; docs
        </a>
      </div>
    </footer>
  )
}
