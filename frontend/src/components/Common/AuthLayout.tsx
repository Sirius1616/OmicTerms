import { Appearance } from "@/components/Common/Appearance"
import { CoverageTrace } from "@/components/Common/GenomicsMotif"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b1e3a] via-[#0e2440] to-[#12335e] lg:flex lg:flex-col lg:items-center lg:justify-between lg:p-10">
        <CoverageTrace className="h-28 w-full opacity-25" />
        <div className="relative z-10 mt-10 flex flex-col items-center gap-6">
          <Logo variant="full" className="h-10" asLink={false} />
          <p className="text-center text-sm text-sky-200/70">
            Importomics <span className="mx-1 text-sky-400/50">·</span>
            Analyze <span className="mx-1 text-sky-400/50">·</span>
            Understand
          </p>
        </div>
        <blockquote className="relative z-10 mb-10 max-w-sm text-center">
          <p className="text-lg italic text-sky-100/90">
            "From raw reads to a plain-language verdict — omics you can actually
            read."
          </p>
          <p className="readout mt-3 text-xs text-sky-300/60">
            cov 38.2x · depth uniform · QC pass
          </p>
        </blockquote>
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-end">
          <Appearance />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
        <Footer />
      </div>
    </div>
  )
}
