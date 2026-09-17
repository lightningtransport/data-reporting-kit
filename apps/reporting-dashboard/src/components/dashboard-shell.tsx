"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "cn"

export type DashboardView =
  | "liquidaciones"
  | "out-schedule"
  | "trucks-return"
  | "diesel"

const VIEWS: Array<{
  id: DashboardView
  href: string
  label: string
  description: string
}> = [
  {
    id: "liquidaciones",
    href: "/",
    label: "Settlements",
    description: "Weekly / monthly summary",
  },
  {
    id: "out-schedule",
    href: "/out-schedule",
    label: "Out Schedule",
    description: "Planned departures",
  },
  {
    id: "trucks-return",
    href: "/trucks-return",
    label: "Trucks Return",
    description: "Expected returns",
  },
  {
    id: "diesel",
    href: "/diesel",
    label: "Diesel",
    description: "Fuel by month and owner",
  },
]

type HeaderState = {
  title?: string
  eyebrow?: string
  subtitle?: ReactNode
  live?: boolean
  actions?: ReactNode
}

const HeaderContext = createContext<{
  setHeader: (next: HeaderState) => void
  clearActions: () => void
} | null>(null)

function LightningLogo() {
  return (
    <svg
      aria-label="Lightning Transportation & Logistics"
      role="img"
      viewBox="0 0 1536 894"
      className="h-auto w-20 shrink-0 sm:w-28"
    >
      <title>Lightning Transportation & Logistics</title>
      <filter id="remove-logo-black" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 1 1 0 0"
        />
      </filter>
      <image
        href="/lightning-transport-logo.png"
        width="1536"
        height="894"
        filter="url(#remove-logo-black)"
      />
    </svg>
  )
}

function viewFromPath(pathname: string): DashboardView {
  if (pathname.startsWith("/out-schedule")) return "out-schedule"
  if (pathname.startsWith("/trucks-return")) return "trucks-return"
  if (pathname.startsWith("/diesel")) return "diesel"
  return "liquidaciones"
}

/** Persist page meta into the shared chrome without remounting Tabs. */
export function useDashboardHeader(state: HeaderState) {
  const ctx = useContext(HeaderContext)
  if (!ctx) {
    throw new Error("useDashboardHeader must be used within DashboardChrome")
  }
  const { setHeader, clearActions } = ctx

  useLayoutEffect(() => {
    setHeader(state)
  })

  useEffect(() => {
    return () => clearActions()
  }, [clearActions])
}

/**
 * Thin compatibility wrapper: registers header meta and renders report body only.
 * Chrome (logo, title, Tabs) lives in the shared (reports) layout.
 */
export function DashboardShell({
  title,
  eyebrow = "Operations",
  subtitle,
  live = true,
  actions,
  children,
}: {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  live?: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  useDashboardHeader({ title, eyebrow, subtitle, live, actions })
  return <div className="flex flex-col gap-4 md:gap-6">{children}</div>
}

/** Native details with accessible summary focus — evidence footers only. */
export function TechnicalDetails({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <details
      className={cn(
        "text-muted-foreground rounded-lg text-xs leading-relaxed",
        className
      )}
    >
      <summary
        className={cn(
          "text-foreground cursor-pointer text-sm font-medium select-none",
          "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      >
        Technical details
      </summary>
      <div className="mt-2 space-y-1">{children}</div>
    </details>
  )
}

export function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const active = viewFromPath(pathname)
  const activeView = VIEWS.find((view) => view.id === active) ?? VIEWS[0]
  const [header, setHeader] = useState<HeaderState>({
    title: activeView.label,
  })
  const [headerPath, setHeaderPath] = useState(pathname)

  // Reset chrome meta as soon as the route changes (before/while body loads).
  // Child useLayoutEffect then fills in subtitle/actions without a parent wipe race.
  if (headerPath !== pathname) {
    setHeaderPath(pathname)
    setHeader({
      title: activeView.label,
      eyebrow: "Operations",
      live: true,
    })
  }

  const headerApi = useMemo(
    () => ({
      setHeader,
      clearActions: () =>
        setHeader((prev) =>
          prev.actions === undefined ? prev : { ...prev, actions: undefined }
        ),
    }),
    []
  )

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  const title = header.title ?? activeView.label
  const eyebrow = header.eyebrow ?? "Operations"
  const live = header.live ?? true

  return (
    <HeaderContext.Provider value={headerApi}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-8">
        <header className="flex flex-col gap-3 border-b border-border pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="shrink-0" aria-label="Go to Settlements">
                <LightningLogo />
              </Link>
              <div className="min-w-0 border-l border-border pl-3">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {eyebrow}
                </p>
                <h1 className="font-heading text-2xl font-bold tracking-tight">
                  {title}
                </h1>
                {header.subtitle ? (
                  <div className="text-muted-foreground mt-0.5 text-sm">
                    {header.subtitle}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {live ? null : <Badge variant="secondary">Snapshot</Badge>}
              {header.actions}
            </div>
          </div>

          <Tabs value={active} className="w-full gap-0">
            <TabsList
              className="h-auto min-h-9 w-full max-w-full justify-start overflow-x-auto"
              aria-label="Report views"
            >
              {VIEWS.map((view) => (
                <TabsTrigger
                  key={view.id}
                  value={view.id}
                  className="min-h-9 px-3"
                  nativeButton={false}
                  render={<Link href={view.href} prefetch />}
                >
                  {view.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>
        <div
          key={pathname}
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
        >
          {children}
        </div>
      </div>
    </HeaderContext.Provider>
  )
}
