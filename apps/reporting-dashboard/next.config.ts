import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Reuse visited report RSC payloads briefly so tab switches feel instant.
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
}

export default nextConfig
