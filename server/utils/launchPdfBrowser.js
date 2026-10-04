/**
 * Persistent Chromium for PDF generation.
 * - Reuses one browser across requests (avoids ~1–3s launch per PDF)
 * - Limits concurrent pages to protect memory under load
 * - Auto-relaunches if the browser disconnects
 *
 * Env:
 *   PDF_MAX_CONCURRENCY — max parallel PDF pages (default 2)
 *   PDF_BROWSER_IDLE_MS — optional idle close (0 = keep forever; default 0)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '..');

const MAX_CONCURRENCY = Math.max(
  1,
  Math.min(8, parseInt(process.env.PDF_MAX_CONCURRENCY || '2', 10) || 2),
);
const IDLE_MS = Math.max(0, parseInt(process.env.PDF_BROWSER_IDLE_MS || '0', 10) || 0);

const existsFile = (candidate) => {
  try {
    return Boolean(candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  } catch {
    return false;
  }
};

const findChromeInCacheDir = (cacheDir) => {
  if (!cacheDir || !fs.existsSync(cacheDir)) return null;
  const chromeRoot = path.join(cacheDir, 'chrome');
  if (!fs.existsSync(chromeRoot)) return null;

  const platforms = fs.readdirSync(chromeRoot);
  for (const platform of platforms) {
    const platformDir = path.join(chromeRoot, platform);
    if (!fs.statSync(platformDir).isDirectory()) continue;

    const candidates = [
      path.join(platformDir, 'chrome-linux64', 'chrome'),
      path.join(platformDir, 'chrome-linux', 'chrome'),
      path.join(platformDir, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(platformDir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(platformDir, 'chrome-win64', 'chrome.exe'),
      path.join(platformDir, 'chrome-win', 'chrome.exe'),
    ];
    for (const candidate of candidates) {
      if (existsFile(candidate)) return candidate;
    }
  }
  return null;
};

/** Ordered list of Chrome executable candidates for this host. */
export const resolveChromeExecutablePath = () => {
  const envPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROME_BIN ||
    '';

  if (existsFile(envPath)) return envPath;

  const configuredCaches = [
    process.env.PUPPETEER_CACHE_DIR,
    path.join(SERVER_ROOT, '.cache', 'puppeteer'),
    path.join(os.homedir(), '.cache', 'puppeteer'),
    '/opt/render/project/src/.cache/puppeteer',
    '/opt/render/project/.cache/puppeteer',
  ].filter(Boolean);

  for (const cacheDir of configuredCaches) {
    const found = findChromeInCacheDir(cacheDir);
    if (found) return found;
  }

  const systemBins = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
  for (const bin of systemBins) {
    if (existsFile(bin)) return bin;
  }

  return undefined;
};

let browserPromise = null;
let browserInstance = null;
let activePages = 0;
const waitQueue = [];
let idleTimer = null;

const clearIdleTimer = () => {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
};

const scheduleIdleClose = () => {
  if (!IDLE_MS || activePages > 0 || waitQueue.length > 0) return;
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (activePages === 0 && waitQueue.length === 0) {
      closePdfBrowser().catch(() => {});
    }
  }, IDLE_MS);
};

const releaseSlot = () => {
  activePages = Math.max(0, activePages - 1);
  const next = waitQueue.shift();
  if (next) next();
  else scheduleIdleClose();
};

const acquireSlot = () =>
  new Promise((resolve) => {
    if (activePages < MAX_CONCURRENCY) {
      activePages += 1;
      clearIdleTimer();
      resolve();
      return;
    }
    waitQueue.push(() => {
      activePages += 1;
      clearIdleTimer();
      resolve();
    });
  });

const attachBrowserHandlers = (browser) => {
  browser.on('disconnected', () => {
    if (browserInstance === browser) {
      browserInstance = null;
      browserPromise = null;
    }
  });
};

const launchFreshBrowser = async () => {
  const executablePath = resolveChromeExecutablePath();
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--mute-audio',
      '--no-first-run',
      '--hide-scrollbars',
    ],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  try {
    const browser = await puppeteer.launch(launchOptions);
    attachBrowserHandlers(browser);
    browserInstance = browser;
    return browser;
  } catch (error) {
    browserPromise = null;
    browserInstance = null;
    const hint =
      'Chrome/Chromium was not found for Puppeteer. ' +
      'On Render, ensure the build installs Chrome into the project cache ' +
      '(see server/.puppeteerrc.cjs and npm run install:chrome), ' +
      'or set PUPPETEER_EXECUTABLE_PATH to a system Chrome binary.';
    const wrapped = new Error(`${hint} Original: ${error.message}`);
    wrapped.cause = error;
    throw wrapped;
  }
};

/**
 * Get the shared PDF browser (lazy-launched once).
 */
export const getPdfBrowser = async () => {
  if (browserInstance) {
    try {
      if (browserInstance.connected !== false) return browserInstance;
    } catch {
      /* fall through to relaunch */
    }
    browserInstance = null;
    browserPromise = null;
  }

  if (!browserPromise) {
    browserPromise = launchFreshBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
};

/**
 * @deprecated Prefer withPdfPage — still returns shared browser for probes.
 */
export const launchPdfBrowser = async () => getPdfBrowser();

/**
 * Run work on a fresh page with concurrency limiting.
 * Always closes the page; never closes the shared browser.
 */
export const withPdfPage = async (fn) => {
  await acquireSlot();
  let page = null;
  try {
    let browser = await getPdfBrowser();
    try {
      page = await browser.newPage();
    } catch (error) {
      // Browser may have died — relaunch once
      browserInstance = null;
      browserPromise = null;
      browser = await getPdfBrowser();
      page = await browser.newPage();
    }
    return await fn(page, browser);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
    releaseSlot();
  }
};

export const closePdfBrowser = async () => {
  clearIdleTimer();
  const browser = browserInstance;
  browserInstance = null;
  browserPromise = null;
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
  }
};

export const getPdfBrowserStats = () => ({
  maxConcurrency: MAX_CONCURRENCY,
  activePages,
  queued: waitQueue.length,
  browserOpen: Boolean(browserInstance),
});

export default launchPdfBrowser;
