import { Loader2Icon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Content-region loader — chrome/Tabs stay mounted; mirrors filter → KPI → table. */
export function ReportLoading({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      className="flex w-full flex-col gap-4 md:gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${title}: ${message}`}
    >
      <span className="sr-only">
        {title}. {message}
      </span>

      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2Icon
          className="size-4 shrink-0 motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span>{message}</span>
      </div>

      <Card size="sm">
        <CardContent className="pt-(--card-spacing)">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader className="gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <div className="bg-muted/40 flex gap-3 border-b px-3 py-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-3 flex-1" />
              ))}
            </div>
            <div className="flex flex-col gap-0 divide-y">
              {Array.from({ length: 6 }).map((_, row) => (
                <div key={row} className="flex gap-3 px-3 py-2.5">
                  {Array.from({ length: 5 }).map((_, col) => (
                    <Skeleton
                      key={col}
                      className={
                        row === 0
                          ? "h-3 flex-1"
                          : row < 3
                            ? "h-3 flex-1 opacity-80"
                            : "h-3 flex-1 opacity-50"
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
