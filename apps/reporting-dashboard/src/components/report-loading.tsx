import { Loader2Icon } from "lucide-react"

export function ReportLoading({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      className="mx-auto flex min-h-[50vh] w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-16 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2Icon
        className="text-muted-foreground size-8 animate-spin"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-foreground text-2xl font-bold tracking-tight">
          {title}
        </p>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  )
}
