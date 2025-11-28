// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["firebasestorage.googleapis.com", "i.imgur.com"],
  },
  async headers() {
    return [
      {
        // すべてのページに適用
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups', // ★ ポップアップを許可
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none', // ★ 埋め込みコンテンツを許可
          },
        ],
      },
    ];
  },
};

export default nextConfig;