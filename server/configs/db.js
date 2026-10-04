import mongoose from "mongoose";
import { seedPickupLocations } from "../controllers/pickupLocationController.js";

/**
 * Build a Mongo connection string that works with:
 * - mongodb://host:27017
 * - mongodb://host:27017/already-named
 * - mongodb+srv://.../?retryWrites=true
 */
export const buildMongoUri = (rawUri, dbName = "car-rental") => {
  const uri = String(rawUri || "").trim();
  if (!uri) throw new Error("MONGODB_URI is empty");

  // Already has a database path segment (not just host)
  try {
    const parsed = new URL(uri);
    const path = parsed.pathname || "";
    if (path && path !== "/" && path.length > 1) {
      return uri;
    }
    parsed.pathname = `/${dbName}`;
    return parsed.toString();
  } catch {
    // Fallback for non-standard URIs
    if (uri.includes("?")) {
      const [base, qs] = uri.split("?");
      const cleaned = base.replace(/\/$/, "");
      if (/\/[^/]+$/.test(cleaned.replace(/^mongodb(\+srv)?:\/\//, ""))) {
        return uri;
      }
      return `${cleaned}/${dbName}?${qs}`;
    }
    return `${uri.replace(/\/$/, "")}/${dbName}`;
  }
};

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not defined");
    process.exit(1);
  }

  try {
    mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err.message));
    mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));

    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log("Database connected");
    try {
      const { runAgencyMigration } = await import("../services/agencyMigration.js");
      await runAgencyMigration();
    } catch (migrationError) {
      console.error("[agencyMigration]", migrationError.message);
    }
    await seedPickupLocations();
    try {
      const { ensurePromotionIndexes } = await import("../services/ensurePromotionIndexes.js");
      await ensurePromotionIndexes();
    } catch (indexError) {
      console.warn("[ensurePromotionIndexes]", indexError.message);
    }
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
