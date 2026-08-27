import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Baileys' dependency tree (audio-decode -> @eshaz/web-worker, jimp, etc.)
  // contains genuinely dynamic `import(variable)` calls that no bundler can
  // statically resolve. Excluding these from the server bundle lets Node
  // resolve them natively from node_modules at runtime instead.
  serverExternalPackages: ["@whiskeysockets/baileys", "audio-decode", "@eshaz/web-worker", "jimp"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
