import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

function CoverageTrace() {
  return (
    <>
      <svg
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-28 w-full opacity-25"
      >
        <path
          d="M0 90 L50 90 L50 40 L100 40 L100 70 L150 70 L150 20 L200 20 L200 60
             L250 60 L250 30 L300 30 L300 80 L350 80 L350 15 L400 15 L400 55
             L450 55 L450 25 L500 25 L500 75 L550 75 L550 40 L600 40 L600 90"
          fill="none"
          stroke="url(#traceStroke)"
          strokeWidth="3"
        />
        <path
          d="M0 100 L600 100"
          fill="none"
          stroke="url(#traceStroke)"
          strokeWidth="1"
          opacity="0.4"
        />
        <defs>
          <linearGradient id="traceStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.55" stopColor="#22c55e" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-y-0 left-0 w-px bg-teal-500/40" />
    </>
  )
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b1e3a] via-[#0e2440] to-[#12335e] lg:flex lg:flex-col lg:items-center lg:justify-between lg:p-10">
        <CoverageTrace />
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
