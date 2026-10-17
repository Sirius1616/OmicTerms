import { ExternalLink, LifeBuoy } from "lucide-react"

const REPO_URL = "https://github.com/Sirius1616/OmicTerms"
const ISSUES_URL = `${REPO_URL}/issues`

export function Footer() {
  const currentYear = new Date().getFullYear()
  const version = import.meta.env.VITE_APP_VERSION || "0.0.0"

  return (
    <footer className="border-t px-6 py-4">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <p>
          OmicTerms v{version} © {currentYear} · From data to discovery
        </p>
        <div className="flex items-center gap-4">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            Source &amp; docs
          </a>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <LifeBuoy className="size-3.5" />
            Report an issue
          </a>
        </div>
      </div>
    </footer>
  )
}
