/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds (Tauri)
  // Dev mode uses the Next.js dev server
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Tauri doesn't support trailing slashes in static export
  trailingSlash: false,
};

module.exports = nextConfig;
