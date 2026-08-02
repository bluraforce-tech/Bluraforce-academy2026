import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Exam forms can include several question-page images (up to 3 MB each).
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
