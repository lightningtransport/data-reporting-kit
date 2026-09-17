"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CheckIcon, ChevronDownIcon, LayoutDashboardIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

function LightningLogo() {
  return (
    <svg
      aria-label="Lightning Transportation & Logistics"
      role="img"
      viewBox="0 0 1536 894"
      className="h-auto w-28 shrink-0 sm:w-32"
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
  const pathname = usePathname()
  const router = useRouter()
  const active = viewFromPath(pathname)
  const activeView = VIEWS.find((view) => view.id === active) ?? VIEWS[0]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0" aria-label="Go to Settlements">
            <LightningLogo />
          </Link>
          <div className="border-l border-border pl-3">
            <p className="text-secondary text-xs font-semibold tracking-[0.16em] uppercase">
              {eyebrow}
            </p>
            <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {subtitle ? <div className="text-muted-foreground text-sm">{subtitle}</div> : null}
          {live ? null : <Badge variant="secondary">Snapshot</Badge>}
          {actions}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="gap-1.5" />}
            >
              <LayoutDashboardIcon data-icon="inline-start" />
              {activeView.label}
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Views</DropdownMenuLabel>
                {VIEWS.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => {
                      if (view.href !== pathname) router.push(view.href)
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium">{view.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {view.description}
                      </span>
                    </span>
                    {view.id === active ? (
                      <CheckIcon className="size-4 shrink-0" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {children}
    </div>
  )
}
