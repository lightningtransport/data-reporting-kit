export default function V2Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
      <div className="bg-muted h-10 w-64 animate-pulse rounded" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-muted h-28 animate-pulse rounded-xl"
          />
        ))}
      </div>
      <div className="bg-muted h-48 animate-pulse rounded-xl" />
      <p className="text-muted-foreground text-sm">
        Loading executive overview…
      </p>
    </div>
  )
}
