const { join } = require('path');

/**
 * Puppeteer configuration for production hosts (Render, etc.).
 *
 * Chrome must be downloaded into the project tree so the build artifact
 * carries the browser into the runtime environment. The default
 * `$HOME/.cache/puppeteer` (/opt/render/.cache/puppeteer on Render) is NOT
 * available at runtime.
 *
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
