/** Bounded transport: deadline includes connection, streamed body and parsing. */
export async function fetchBoundedJson(
  url: string | URL,
  init: RequestInit,
  options: { maxBytes?: number; timeoutMs?: number; fetcher?: typeof fetch; allowedStatuses?: number[] } = {}
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    return await Promise.race([
      (async () => {
        const response = await (options.fetcher ?? fetch)(url, { ...init, cache: "no-store", redirect: "error", credentials: "omit", signal: controller.signal })
        if ((!response.ok && !options.allowedStatuses?.includes(response.status)) || !response.body) throw new Error("Reporting source unavailable")
        const size = response.headers.get("content-length")
        if (size !== null && (!/^\d+$/.test(size) || Number(size) > maxBytes)) {
          await response.body.cancel()
          throw new Error("Reporting source exceeds bound")
        }
        reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let bytes = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > maxBytes) throw new Error("Reporting source exceeds bound")
          chunks.push(value)
        }
        const buffer = new Uint8Array(bytes)
        let offset = 0
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)) as unknown
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Reporting source timeout")) }, options.timeoutMs ?? 20000)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    controller.abort()
    // Do not wait for an uncooperative upstream cancellation beyond the deadline.
    void reader?.cancel().catch(() => {})
  }
}
