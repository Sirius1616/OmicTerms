export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
]

/** Human relative time, e.g. "3 hours ago". */
export function formatRelativeTime(
  dateString: string,
  now: Date = new Date(),
): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }

  const diff = date.getTime() - now.getTime()
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }
  return formatter.format(Math.round(diff / 1000), "second")
}

/** File name (basename) from a stored file URL/path. */
export function fileNameFromUrl(fileUrl: string): string {
  return fileUrl.split("/").pop() || fileUrl
}

/** Uppercase extension without the dot, e.g. "VCF". */
export function fileExtension(fileUrl: string): string {
  const name = fileNameFromUrl(fileUrl)
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toUpperCase()
}
