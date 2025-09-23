
module.exports = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  workboxOptions: {
    clientsClaim: true,
  },
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
};
