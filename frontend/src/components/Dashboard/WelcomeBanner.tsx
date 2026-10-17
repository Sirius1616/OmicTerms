import { Link } from "@tanstack/react-router"
import { ArrowRight, Compass, Database, GraduationCap } from "lucide-react"

import { DataRibbon } from "@/components/Common/DataRibbon"
import { Button } from "@/components/ui/button"

interface WelcomeBannerProps {
  displayName: string
}

export function WelcomeBanner({ displayName }: WelcomeBannerProps) {
  const focusActivity = () => {
    const panel = document.getElementById("activity")
    panel?.scrollIntoView({ behavior: "smooth", block: "start" })
    panel?.focus()
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex flex-col gap-3">
          <span className="overline text-muted-foreground">
            Research workspace
          </span>
          <h1 className="text-xl">Welcome back, {displayName}.</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Validate, connect, and report on multi-omics data — and learn the
            biology as you go.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link to="/documents">
                <Database className="size-4" />
                Open Data Sources
              </Link>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/academy">
                <GraduationCap className="size-4" />
                Explore Academy
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={focusActivity}>
              <Compass className="size-4" />
              Recent activity
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="hidden h-32 w-72 shrink-0 xl:block">
          <DataRibbon />
        </div>
      </div>
    </div>
  )
}
