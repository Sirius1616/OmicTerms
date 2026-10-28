import type { ComponentType, CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { DataType } from "@/types/documents"

export type GlyphProps = {
  className?: string
  title?: string
}

function Glyph({
  className,
  title,
  children,
}: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  )
}

export function DnaGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 2.5c0 3.5 8 4.5 8 9.5s-8 6-8 9.5" />
      <path d="M16 2.5c0 3.5-8 4.5-8 9.5s8 6 8 9.5" />
      <path d="M8.7 6.2h6.6" />
      <path d="M8.7 17.8h6.6" />
    </Glyph>
  )
}

export function ExpressionGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 20h17" />
      <path d="M6.5 20v-5.5" />
      <path d="M10.5 20v-11" />
      <path d="M14.5 20v-3.5" />
      <path d="M18.5 20v-8" />
    </Glyph>
  )
}

export function MethylationGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3 18.5h18" />
      <path d="M8 18.5v-4.2" />
      <circle cx="8" cy="11.6" r="2.3" />
      <path d="M16 18.5v-4.2" />
      <circle cx="16" cy="11.6" r="2.3" />
    </Glyph>
  )
}

export function PeakGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3 19h3l2.6-9.5 3 6.8L14 5.5l3 13.5h4" />
    </Glyph>
  )
}

export function ProteinGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M5 16.5C5 11.4 8.2 9 12 9s7 2.4 7 7.5" />
      <circle cx="5" cy="16.5" r="1.7" />
      <circle cx="12" cy="9" r="1.7" />
      <circle cx="19" cy="16.5" r="1.7" />
    </Glyph>
  )
}

export function MicrobiomeGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="7" cy="7" r="2" />
      <circle cx="12" cy="5.4" r="1.8" />
      <circle cx="16.6" cy="8" r="2" />
      <circle cx="10.6" cy="11.6" r="1.8" />
      <rect x="5.4" y="14.8" width="8.2" height="4.2" rx="2.1" />
    </Glyph>
  )
}

export function SampleGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v15a2 2 0 0 0 4 0V3" />
      <path d="M10 12.5h4" />
    </Glyph>
  )
}

export function AnalysisGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M4 4v16h16" />
      <circle cx="9" cy="15" r="1.4" />
      <circle cx="13.2" cy="11" r="1.4" />
      <circle cx="16.6" cy="14.2" r="1.4" />
      <circle cx="11.8" cy="17.2" r="1.4" />
    </Glyph>
  )
}

export function FindingGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3 18h18" />
      <path d="M11 18V5" />
      <path d="M11 5l6 2.5-6 2.5" />
    </Glyph>
  )
}

export function ReportGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M6 3h7l5 5v13H6z" />
      <path d="M13 3v5h5" />
      <path d="M9.4 17v-3" />
      <path d="M12.4 17v-5" />
      <path d="M15.4 17v-2" />
    </Glyph>
  )
}

export function ProjectGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 5.5h17v13h-17z" />
      <path d="M3.5 9.5h17" />
      <path d="M7 7.5h4" />
      <circle cx="8" cy="14.5" r="1.4" />
      <circle cx="12.5" cy="14.5" r="1.4" />
      <circle cx="16.5" cy="14.5" r="1.4" />
    </Glyph>
  )
}

export function ExperimentGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M9.5 3h5" />
      <path d="M10.5 3v5.4L6.4 17.6A2.2 2.2 0 0 0 8.4 21h7.2a2.2 2.2 0 0 0 2-3.4L13.5 8.4V3" />
      <path d="M8.2 14h7.6" />
    </Glyph>
  )
}

export function ProvenanceGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="5" cy="12" r="2.1" />
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="19" cy="12" r="2.1" />
      <path d="M7.2 12h2.6" />
      <path d="M14.2 12h2.6" />
    </Glyph>
  )
}

export function ValidationGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M5 4h9l4 4v12H5z" />
      <path d="M14 4v4h4" />
      <path d="M9 14l2 2 4-4.5" />
    </Glyph>
  )
}

export function ChecksumGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4a8 8 0 0 0-8 8v3.5" />
      <path d="M12 4a8 8 0 0 1 8 8v3.5" />
      <path d="M12 7a5 5 0 0 0-5 5v4" />
      <path d="M12 7a5 5 0 0 1 5 5v4" />
      <path d="M12 10.2a1.8 1.8 0 0 0-1.8 1.8v4" />
      <path d="M12 10.2a1.8 1.8 0 0 1 1.8 1.8v4" />
    </Glyph>
  )
}

export function GraphGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="4.6" r="2.1" />
      <circle cx="5.4" cy="18" r="2.1" />
      <circle cx="18.6" cy="18" r="2.1" />
      <path d="M12 6.7v4.1" />
      <path d="M10.6 12.3 6.6 15.9" />
      <path d="M13.4 12.3l4 3.6" />
    </Glyph>
  )
}

export function DataSourcesGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.2 20 7l-8 3.8L4 7z" />
      <path d="m4 12 8 3.8 8-3.8" />
      <path d="m4 16.6 8 3.8 8-3.8" />
    </Glyph>
  )
}

export type IconComponent = ComponentType<GlyphProps>

export type OmicsToken =
  | "--omics-variants"
  | "--omics-expression"
  | "--omics-methylation"
  | "--omics-peaks"
  | "--omics-proteomics"
  | "--omics-microbiome"
  | "--omics-sample"
  | "--omics-project"
  | "--omics-experiment"
  | "--omics-analysis"
  | "--omics-finding"
  | "--omics-document"

const OMICS_CLASSES: Record<
  OmicsToken,
  { text: string; border: string; bg: string; dot: string; solid: string }
> = {
  "--omics-variants": {
    text: "text-omics-variants",
    border: "border-omics-variants/45",
    bg: "bg-omics-variants/12",
    dot: "bg-omics-variants",
    solid: "bg-omics-variants",
  },
  "--omics-expression": {
    text: "text-omics-expression",
    border: "border-omics-expression/45",
    bg: "bg-omics-expression/12",
    dot: "bg-omics-expression",
    solid: "bg-omics-expression",
  },
  "--omics-methylation": {
    text: "text-omics-methylation",
    border: "border-omics-methylation/45",
    bg: "bg-omics-methylation/12",
    dot: "bg-omics-methylation",
    solid: "bg-omics-methylation",
  },
  "--omics-peaks": {
    text: "text-omics-peaks",
    border: "border-omics-peaks/45",
    bg: "bg-omics-peaks/12",
    dot: "bg-omics-peaks",
    solid: "bg-omics-peaks",
  },
  "--omics-proteomics": {
    text: "text-omics-proteomics",
    border: "border-omics-proteomics/45",
    bg: "bg-omics-proteomics/12",
    dot: "bg-omics-proteomics",
    solid: "bg-omics-proteomics",
  },
  "--omics-microbiome": {
    text: "text-omics-microbiome",
    border: "border-omics-microbiome/45",
    bg: "bg-omics-microbiome/12",
    dot: "bg-omics-microbiome",
    solid: "bg-omics-microbiome",
  },
  "--omics-sample": {
    text: "text-omics-sample",
    border: "border-omics-sample/45",
    bg: "bg-omics-sample/12",
    dot: "bg-omics-sample",
    solid: "bg-omics-sample",
  },
  "--omics-project": {
    text: "text-omics-project",
    border: "border-omics-project/45",
    bg: "bg-omics-project/12",
    dot: "bg-omics-project",
    solid: "bg-omics-project",
  },
  "--omics-experiment": {
    text: "text-omics-experiment",
    border: "border-omics-experiment/45",
    bg: "bg-omics-experiment/12",
    dot: "bg-omics-experiment",
    solid: "bg-omics-experiment",
  },
  "--omics-analysis": {
    text: "text-omics-analysis",
    border: "border-omics-analysis/45",
    bg: "bg-omics-analysis/12",
    dot: "bg-omics-analysis",
    solid: "bg-omics-analysis",
  },
  "--omics-finding": {
    text: "text-omics-finding",
    border: "border-omics-finding/45",
    bg: "bg-omics-finding/12",
    dot: "bg-omics-finding",
    solid: "bg-omics-finding",
  },
  "--omics-document": {
    text: "text-omics-document",
    border: "border-omics-document/45",
    bg: "bg-omics-document/12",
    dot: "bg-omics-document",
    solid: "bg-omics-document",
  },
}

export function omicsClasses(token: OmicsToken) {
  return OMICS_CLASSES[token]
}

/** Style hook that drives the `.omics-chip` / `.omics-dot` helper classes. */
export function omicsAccent(token: OmicsToken): CSSProperties {
  return { "--accent-omics": `var(${token})` } as CSSProperties
}

export type DataTypeMeta = {
  label: string
  meaning: string
  token: OmicsToken
  Icon: ComponentType<GlyphProps>
}

export const DATA_TYPE_META: Record<DataType, DataTypeMeta> = {
  variants: {
    label: "Variants",
    meaning: "VCF — variant calls",
    token: "--omics-variants",
    Icon: DnaGlyph,
  },
  expression: {
    label: "Expression",
    meaning: "Gene / transcript matrix",
    token: "--omics-expression",
    Icon: ExpressionGlyph,
  },
  methylation: {
    label: "Methylation",
    meaning: "CpG methylation matrix",
    token: "--omics-methylation",
    Icon: MethylationGlyph,
  },
  peaks: {
    label: "Peaks",
    meaning: "BED — ChIP / ATAC peaks",
    token: "--omics-peaks",
    Icon: PeakGlyph,
  },
  document: {
    label: "Document",
    meaning: "PDF or plain text",
    token: "--omics-document",
    Icon: ReportGlyph,
  },
}
