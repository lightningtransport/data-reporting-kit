/** Shared TTL for live Diesel fuel aggregates (seconds). Real agent-reporting data only. */
export const DIESEL_TREND_REVALIDATE_SECONDS = 180
export const DIESEL_MONTH_REVALIDATE_SECONDS = 120

/** Browser/CDN stale-while-revalidate window after s-maxage. */
export const DIESEL_SWR_SECONDS = 300

export function dieselCacheControl(sMaxAge: number): string {
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${DIESEL_SWR_SECONDS}`
}

export const DIESEL_TREND_SESSION_KEY = "ltl-diesel-fuel-trend-v1"
/** Client may paint from sessionStorage up to this age, then must wait for network. */
export const DIESEL_TREND_SESSION_MAX_AGE_MS = 30 * 60 * 1000
