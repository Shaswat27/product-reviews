import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Ensure these prompt files are bundled for the server routes that read them
    // @ts-expect-error: not in current Next types, but supported at runtime
    outputFileTracingIncludes: {
      "/api/ingest/run": ["./src/prompts/synthesize.md", "./data/mock_reviews.json", "./src/prompts/extract.haiku.md"],
      "/api/extract": ["./src/prompts/extract.haiku.md"],
    },
  },

  // Load .md files as raw source strings so `import prompt from './x.md'` works
  webpack(config) {
    config.module.rules.push({
      test: /\.md$/i,
      type: "asset/source",
    });
    return config;
  },

  eslint: {
    // Keep strict: fail the build on lint errors
    ignoreDuringBuilds: false,
  },

  typescript: {
    // Keep strict: fail the build on TS errors
    ignoreBuildErrors: false,
  },
};

export default nextConfig;