
/** @type {import('next-pwa').PWAConfig} */
module.exports = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: false,
  runtimeCaching: [
    {
      // Cache pages/navigation
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        networkTimeoutSeconds: 3, // Fallback to cache faster when offline
      },
    },
    {
      // Cache RSC payloads (Next.js Server Components)
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
        networkTimeoutSeconds: 3,
      },
    },
    {
      // Cache static resources
      urlPattern: /\.(?:js|css|png|gif|jpg|jpeg|svg|woff|woff2|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      // Cache API calls to Django (for offline capability)
      urlPattern: /^https:\/\/logistik-production\.up\.railway\.app\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 5,
      },
    },
  ],
};
