/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.lan',
    '*.local',
    '10.*.*.*',
    '172.*.*.*',
    '192.168.*.*',
  ],
};

export default nextConfig;
