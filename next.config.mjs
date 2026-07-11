/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zoom/meetingsdk", "@maily-to/core", "@maily-to/render"],
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb"
    }
  }
};

export default nextConfig;
