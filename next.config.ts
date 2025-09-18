import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-expect-error: not in current Next types, but supported at runtime
    outputFileTracingIncludes: {
      "/api/synthesize": ["./src/prompts/synthesize.md"],
    },
    // @ts-expect-error: not in current Next types, but supported at runtime
    outputFileTracingIncludes: {
      "/api/extract": ["./src/prompts/extract.haiku.md"],
    },
  },
};

export default nextConfig;