import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 面试短链：中文四字路径统一到 grkj
      { source: "/%E5%9B%BD%E9%94%90%E7%A7%91%E6%8A%80", destination: "/grkj", permanent: false },
      { source: "/国锐科技", destination: "/grkj", permanent: false },
      { source: "/grkj", destination: "/lab", permanent: false },
    ];
  },
};

export default nextConfig;
