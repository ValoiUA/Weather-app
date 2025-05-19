/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['openweathermap.org'],
  },
  webpack: (config) => {
    // This is needed for Leaflet to work properly
    config.resolve.alias = {
      ...config.resolve.alias,
      'leaflet$': 'leaflet',
    };
    return config;
  },
};

module.exports = nextConfig;
