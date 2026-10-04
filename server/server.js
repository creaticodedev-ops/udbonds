import express from "express";
import "dotenv/config";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoutes.js";
import ownerRouter from "./routes/ownerRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import pickupLocationRouter from "./routes/pickupLocationRoutes.js";
import completionRouter from "./routes/bookingCompletionRoutes.js";
import superAdminRouter from "./routes/superAdminRoutes.js";
import agencyOnboardingRouter from "./routes/agencyOnboardingRoutes.js";
import staffOnboardingRouter from "./routes/staffOnboardingRoutes.js";
import publicStorefrontRouter from "./routes/publicStorefrontRoutes.js";
import contractRouter from "./routes/contractRoutes.js";
import invoiceRouter from "./routes/invoiceRoutes.js";
import exportTemplateRouter from "./routes/exportTemplateRoutes.js";
import { protectDocumentUploads } from "./middleware/uploadAccess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "../client/dist");
const clientIndexPath = path.resolve(__dirname, "../client/index.html");
const hasBuiltClient = fs.existsSync(path.join(clientDistPath, "index.html"));

const requiredEnv = ["MONGODB_URI", "JWT_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (String(process.env.JWT_SECRET).length < 32) {
  const msg = "JWT_SECRET must be at least 32 characters for production security";
  if (process.env.NODE_ENV === "production") {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`[security] ${msg} (allowed in non-production)`);
}

const app = express();

// Needed for correct client IP behind reverse proxies (rate limiting)
if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

await connectDB();

try {
  const { ensureDefaultPlans } = await import("./services/planCatalog.js");
  await ensureDefaultPlans();
} catch (planErr) {
  console.warn("[startup] plan seed:", planErr.message);
}

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim()).filter(Boolean)
  : [ "https://kririder.com",
      "https://www.kririder.com",
      "http://localhost:5173",
      "http://localhost:3000"];

const platformBase = String(process.env.PLATFORM_BASE_DOMAIN || "")
  .trim()
  .toLowerCase()
  .replace(/^\.+|\.+$/g, "");

const isPlatformSubdomainOrigin = (origin) => {
  if (!platformBase || !origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return host === platformBase || host.endsWith(`.${platformBase}`);
  } catch {
    return false;
  }
};

/** Cached set of verified custom domain hosts for CORS (refreshed periodically). */
let customDomainOriginCache = { at: 0, hosts: new Set() };
const refreshCustomDomainHosts = async () => {
  if (Date.now() - customDomainOriginCache.at < 60_000) return;
  try {
    const Agency = (await import("./models/Agency.js")).default;
    const rows = await Agency.find({
      customDomainStatus: { $in: ["verified", "active"] },
      customDomain: { $type: "string", $ne: "" },
    })
      .select("customDomain")
      .lean();
    const hosts = new Set();
    for (const row of rows) {
      const d = String(row.customDomain || "").toLowerCase().replace(/^www\./, "");
      if (d) {
        hosts.add(d);
        hosts.add(`www.${d}`);
      }
    }
    customDomainOriginCache = { at: Date.now(), hosts };
  } catch {
    /* ignore — fail closed to allowlist only */
  }
};

const isCustomDomainOrigin = async (origin) => {
  if (!origin) return false;
  try {
    await refreshCustomDomainHosts();
    const host = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
    return (
      customDomainOriginCache.hosts.has(host) ||
      customDomainOriginCache.hosts.has(`www.${host}`)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: async (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (isPlatformSubdomainOrigin(origin)) {
        callback(null, true);
        return;
      }
      if (await isCustomDomainOrigin(origin)) {
        callback(null, true);
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Gzip compression — lowers transfer size for HTML/JSON/JS/CSS (Lighthouse TTFB/weight)
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// Baseline security headers (no extra dependency)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// Signature payloads can be larger than default
app.use(express.json({ limit: "4mb" }));

// Sensitive docs require signed URL or admin JWT
app.use(
  "/uploads",
  protectDocumentUploads,
  express.static(path.join(__dirname, "uploads"), {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.get("/", (req, res, next) => {
  // When the built SPA is served from this process, defer `/` to the HTML shell.
  if (hasBuiltClient && req.accepts("html") && !req.path.startsWith("/api")) {
    return next()
  }
  return res.json({ success: true, message: "Server is running" })
})

app.get("/health", async (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbOk = dbState === 1;
  res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    status: dbOk ? "healthy" : "degraded",
    database: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

if (hasBuiltClient) {
  app.use(
    express.static(clientDistPath, {
      index: false,
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        // Vite hashed assets: long-lived immutable cache
        if (/\.[a-f0-9]{8,}\./i.test(base) || /[\\/]assets[\\/]/i.test(filePath)) {
          if (/\.(js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|ico)$/i.test(base)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            return;
          }
        }
        // Public images (hero preload paths)
        if (/[\\/]images[\\/]/i.test(filePath) && /\.(webp|avif|png|jpe?g|svg)$/i.test(base)) {
          res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
          return;
        }
        if (base === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );
}

app.use("/api/user", userRouter);
app.use("/api/owner", ownerRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/pickup-locations", pickupLocationRouter);
app.use("/api/booking-completion", completionRouter);
app.use("/api/super-admin", superAdminRouter);
app.use("/api/agency-onboarding", agencyOnboardingRouter);
app.use("/api/staff-onboarding", staffOnboardingRouter);
app.use("/api/public/storefront", publicStorefrontRouter);
app.use("/api/contracts", contractRouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/export-templates", exportTemplateRouter);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  if (!req.accepts("html")) {
    return next();
  }

  const indexFile = hasBuiltClient ? path.join(clientDistPath, "index.html") : clientIndexPath;
  if (fs.existsSync(indexFile)) {
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(indexFile);
  }

  return next();
});

app.use((_req, res) => {
  const reqPath = _req.originalUrl || _req.url;
  let message = "Route not found";
  if (reqPath.includes("/api/api/")) {
    message =
      "Route not found — API base URL likely includes `/api` twice. Set VITE_BASE_URL to the server origin only (e.g. http://localhost:3000), not http://localhost:3000/api";
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[404] ${_req.method} ${reqPath}`);
  }
  res.status(404).json({ success: false, message, path: process.env.NODE_ENV !== "production" ? reqPath : undefined });
});

app.use((err, _req, res, _next) => {
  console.error(err?.message || err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: "CORS policy violation" });
  }
  // express.static(fallthrough:false) forwards missing files as err.status=404 —
  // respect that instead of masking every failure as a 500.
  const status = Number(err.status || err.statusCode) || 500;
  if (status === 404) {
    return res.status(404).json({ success: false, message: "File not found" });
  }
  if (status >= 400 && status < 500) {
    return res.status(status).json({
      success: false,
      message: err.message || "Request failed",
    });
  }
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    '[routes] Booking workflow: POST /api/booking-completion/owner/ensure-link, /api/bookings/owner/completion/ensure-link',
  );
  import('./services/pendingBookingExpiry.js')
    .then(({ startPendingBookingExpiryJob }) => startPendingBookingExpiryJob())
    .catch((error) => console.warn('[pendingExpiry] failed to start:', error.message));
});

const shutdown = async (signal) => {
  console.log(`[shutdown] ${signal} received`);
  try {
    const { closePdfBrowser } = await import('./utils/launchPdfBrowser.js');
    await closePdfBrowser();
  } catch (error) {
    console.warn('[shutdown] PDF browser close:', error.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
