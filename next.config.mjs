/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Avoid automatic slash normalization redirects to reduce unnecessary hops.
    skipTrailingSlashRedirect: true,
    // Enable gzip/brotli compression — fixes "Applies text compression" audit
    compress: true,
    images: {
        minimumCacheTTL: 31536000,
    },
    experimental: {
        optimizeCss: true,
        cssChunking: 'strict',
        inlineCss: true,
        optimizePackageImports: ['lucide-react', 'framer-motion'],
    },
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },
    async headers() {
        if (process.env.NODE_ENV !== 'production') {
            return [];
        }

        return [
            {
                source: '/logos/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
        ];
    },
    async redirects() {
        return [
            { source: '/admin/dashboard', destination: '/admin/clients', permanent: true },
            { source: '/admin/dashboard/new', destination: '/admin/clients/new', permanent: true },
            {
                source: '/admin/dashboard/:clientId',
                destination: '/admin/clients/:clientId/overview',
                permanent: true,
            },
            {
                source: '/admin/clients/:id/seo-geo',
                destination: '/admin/clients/:id/overview',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
