/** @type {import('next').NextConfig} */
const nextConfig = {
  // The contracts package ships TypeScript source; let Next transpile it.
  transpilePackages: ['@invoice-saas/contracts'],
};

export default nextConfig;
