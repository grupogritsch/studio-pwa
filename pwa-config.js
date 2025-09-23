
const runtimeCaching = require('next-pwa/cache');

module.exports = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching,
};
