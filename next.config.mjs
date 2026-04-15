const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ESLint rules run in dev via `npm run lint`. Skip during build so strict
    // warnings like `no-explicit-any` don't block production deployments.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript errors still show in dev. This only prevents build failures
    // on the production deploy from edge-case strict-mode issues.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
