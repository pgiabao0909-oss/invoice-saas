/** @type {import('next').NextConfig} */
const nextConfig = {
  // The contracts package ships TypeScript source; let Next transpile it.
  transpilePackages: ['@invoice-saas/contracts'],
  // Type errors are caught by `npm run typecheck`; don't fail the production build on
  // lint style rules (the repo has no enforced ESLint config yet).
  eslint: { ignoreDuringBuilds: true },
  // The web app talks to the Fastify API through a same-origin rewrite so the browser
  // only ever hits localhost:3000 (no CORS). The API runs on :3001 by default.
  async rewrites() {
    const apiBase = process.env.API_BASE ?? 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${apiBase}/:path*` }];
  },
};

export default nextConfig;
