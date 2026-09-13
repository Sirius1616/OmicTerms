import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { Dna, FileUp, Microscope } from "lucide-react"
import { Suspense } from "react"

import {
  BasePairCode,
  BaseRain,
  CoverageTrace,
  FlowLane,
  HelixDivider,
  HelixSpinner,
  LabReadout,
  ScanBeam,
} from "@/components/Common/GenomicsMotif"
import { SpecimenDeck } from "@/components/Common/SpecimenDeck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { documentsApi } from "@/services/documents"
import { formatDate } from "@/utils/format"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - OmicTerms",
      },
    ],
  }),
})

function getDocumentsQueryOptions() {
  return {
    queryFn: () => documentsApi.listDocuments(),
    queryKey: ["documents"],
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: "border-cytosine/60 text-cytosine",
  success: "border-adenine/60 text-adenine",
  failed: "border-thymine/60 text-thymine",
}

function RecentDocuments() {
  const { data: documents } = useSuspenseQuery(getDocumentsQueryOptions())
  const recent = documents.data.slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Dna className="size-4 text-primary" />
          Recent samples
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <RouterLink to="/documents">View all</RouterLink>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Dna className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No samples loaded yet</h3>
            <p className="text-muted-foreground">
              Upload your first omics file to begin analysis
            </p>
            <Button className="mt-4" asChild>
              <RouterLink to="/documents">
                <FileUp className="mr-2" />
                Upload data
              </RouterLink>
            </Button>
          </div>
        ) : (
          recent.map((document) => (
            <RouterLink
              key={document.id}
              to="/documents/$documentId"
              params={{ documentId: document.id }}
              className="group flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/50"
            >
              <div className="rounded-md bg-muted p-2 transition-transform duration-200 group-hover:scale-110">
                <Dna className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">
                  {document.file_url.split("/").pop()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(document.uploaded_at)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "border bg-transparent",
                  document.extraction_status === "pending" && "gm-pulseglow",
                  STATUS_COLORS[document.extraction_status] ??
                    "border-border text-muted-foreground",
                )}
              >
                {document.extraction_status}
              </Badge>
            </RouterLink>
          ))
        )}
      </CardContent>
    </Card>
  )
}

const METRICS = [
  {
    icon: Microscope,
    title: "Omics analysis",
    body: "Upload expression, methylation, variant or peak files. Each type gets the right statistical treatment.",
    accent: "from-cyan-500/20 to-transparent",
  },
  {
    icon: Dna,
    title: "Explained plainly",
    body: "Every p-value, fold-change and cluster gets translated into a verdict you can act on — not just a plot.",
    accent: "from-adenine/20 to-transparent",
  },
  {
    icon: FileUp,
    title: "Organized by design",
    body: "Samples live inside experiments inside projects, so your hierarchy always reflects your study design.",
    accent: "from-guanine/20 to-transparent",
  },
]

function Dashboard() {
  const { user: currentUser } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-background p-6 md:p-8">
        <ScanBeam />
        <CoverageTrace className="h-24 opacity-20" />
        <div className="relative z-10 flex flex-col gap-3 pb-14">
          <div className="flex flex-wrap items-center gap-3">
            <BasePairCode className="w-fit" />
            <span className="readout text-[10px] text-muted-foreground/70">
              loading sample · waiting for reads
            </span>
          </div>
          <h1 className="text-2xl">
            Hi, {currentUser?.full_name || currentUser?.email}
          </h1>
          <p className="text-muted-foreground">
            Your sequencing workspace is ready.
          </p>
          <LabReadout />
        </div>
        <HelixSpinner className="pointer-events-none absolute -right-6 top-0 hidden h-40 w-40 opacity-70 sm:block" />
        <BaseRain className="absolute inset-x-0 bottom-0 h-5" />
        <FlowLane className="pointer-events-none absolute inset-x-0 bottom-5 h-6" />
      </div>

      <SpecimenDeck />

      <div className="grid gap-6 md:grid-cols-3">
        {METRICS.map(({ icon: Icon, title, body, accent }) => (
          <Card
            key={title}
            className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative overflow-hidden text-sm text-muted-foreground">
              <div
                className={cn(
                  "pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br transition-transform duration-300 group-hover:scale-125",
                  accent,
                )}
              />
              {body}
            </CardContent>
          </Card>
        ))}
      </div>

      <HelixDivider className="text-primary/40" />

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-lg" />
              ))}
            </CardContent>
          </Card>
        }
      >
        <RecentDocuments />
      </Suspense>
    </div>
  )
}
