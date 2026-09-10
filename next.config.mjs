import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * These must run in the Node runtime rather than being bundled. The list
   * includes MongoDB's optional client-side-encryption dependencies: the
   * scheduler is started from instrumentation.ts, which pulls mongoose in, and
   * bundling that chain fails on Node built-ins like `https` and `net`.
   */
  serverExternalPackages: [
    'mongoose',
    'mongodb',
    'bcryptjs',
    'gcp-metadata',
    'gaxios',
    'google-auth-library',
    'https-proxy-agent',
    'agent-base',
    'socks',
    'aws4',
    'kerberos',
    'mongodb-client-encryption',
    'snappy',
  ],
  // Pin the root: an unrelated lockfile in the home directory otherwise makes
  // Next infer the wrong workspace root.
  outputFileTracingRoot: here,
}

export default nextConfig
