/** Reject duplicate keys (including escaped equivalents) after JSON syntax validation. */
function parseStrictJson(text: string): unknown {
  const parsed = JSON.parse(text, (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite JSON number")
    return value
  })
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g) ?? []
  const stack: (Set<string> | null)[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === "{") stack.push(new Set())
    else if (token === "[") stack.push(null)
    else if (token === "}" || token === "]") stack.pop()
    else if (token.startsWith('"') && tokens[i + 1] === ":") {
      const key = JSON.parse(token) as string
      const keys = stack[stack.length - 1]
      if (!keys || keys.has(key)) throw new Error("Duplicate JSON key")
      keys.add(key)
    }
  }
  return parsed
}

/** Bounded transport: deadline includes connection, streamed body and parsing. */
export async function fetchBoundedJson(
  url: string | URL,
  init: RequestInit,
  options: { maxBytes?: number; timeoutMs?: number; fetcher?: typeof fetch; allowedStatuses?: number[]; strictJson?: boolean } = {}
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024
  const deadline = performance.now() + (options.timeoutMs ?? 20000)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    return await Promise.race([
      (async () => {
        const response = await (options.fetcher ?? fetch)(url, { ...init, cache: "no-store", redirect: "error", credentials: "omit", signal: controller.signal })
        if ((!response.ok && !options.allowedStatuses?.includes(response.status)) || !response.body) throw new Error("Reporting source unavailable")
        if (options.strictJson && (response.redirected || !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? ""))) {
          void response.body.cancel().catch(() => {})
          throw new Error("Invalid JSON media type or redirect")
        }
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
        // fetch decompresses encoded bodies; only compare identity transfer lengths.
        const encoding = response.headers.get("content-encoding")
        if (options.strictJson && size !== null && (!encoding || encoding.toLowerCase() === "identity") && Number(size) !== bytes) {
          throw new Error("Truncated or inconsistent reporting body")
        }
        const buffer = new Uint8Array(bytes)
        let offset = 0
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
        const result = options.strictJson ? parseStrictJson(text) : JSON.parse(text) as unknown
        if (performance.now() >= deadline) throw new Error("Reporting source timeout")
        return result
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
