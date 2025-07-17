/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile Ant Design packages for better compatibility
  transpilePackages: ['antd', '@ant-design/icons'],
  
  experimental: {
    // Your existing turbo configuration
    turbo: {
      // Add font configuration if using turbopack
      resolveAlias: {
        '@next/font': '@next/font'
      }
    },
    // Optimize Ant Design imports
    optimizePackageImports: ['antd'],
    // Better ESM handling
    esmExternals: 'loose'
  },
  
  // Improve build performance and compatibility
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production'
  },
  
  // Better webpack configuration for Ant Design
  webpack: (config, { dev, isServer }) => {
    // Ant Design optimization
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@ant-design/icons/lib': '@ant-design/icons/es'
      }
    }
    return config
  }
}

module.exports = nextConfig