/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  
  // Disable type checking during build to speed up
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Exclude heavy dependencies from bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        os: false,
        path: false,
      };
    }
    
    // Exclude TensorFlow and other heavy dependencies
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('@tensorflow/tfjs-node', '@tensorflow/tfjs-node-gpu', 'sharp');
    }
    
    return config;
  },
}

module.exports = nextConfig