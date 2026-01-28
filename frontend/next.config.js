/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export for production builds (Electron)
  // Dev mode uses the Next.js dev server
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Electron handles routing, no trailing slashes needed
  trailingSlash: false,
};

module.exports = nextConfig;
