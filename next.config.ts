import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['mongoose', 'node-cron', 'bcryptjs'],
}

export default nextConfig
