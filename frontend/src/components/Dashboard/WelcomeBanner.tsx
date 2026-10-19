import { Link } from "@tanstack/react-router"
import { ArrowRight, Compass, Database, GraduationCap } from "lucide-react"
import { HeroHelix } from "@/components/Dashboard/HeroHelix"
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
      <div className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block">
        <img
          src="/omicterms_hero_ref.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover hero-fade"
        />
        <HeroHelix className="absolute right-[2%] top-1/2 h-[260%] w-[15rem] -translate-y-1/2 hero-fade xl:right-[3%] xl:w-[18rem] 2xl:w-[22rem]" />
      </div>

      <div className="relative z-10 flex flex-col gap-4 p-5 md:p-6 md:pr-[16rem] lg:pr-[20rem] xl:pr-[24rem]">
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
      </div>
    </div>
  )
}
