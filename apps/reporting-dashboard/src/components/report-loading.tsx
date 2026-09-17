import { Loader2Icon } from "lucide-react"

/** Content-region loader — chrome/Tabs stay mounted in the (reports) layout. */
export function ReportLoading({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 py-12 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2Icon
        className="text-muted-foreground size-8 motion-safe:animate-spin"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-foreground text-lg font-bold tracking-tight">
          {title}
        </p>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  )
}
