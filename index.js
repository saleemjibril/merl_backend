import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { connectDb } from "./config/db.js";
import routes from "./routes/index.js";
import { notFound, globalErrorHandler } from "./middleware/error.js";
import Template from "./models/Template.js";
import IndicatorActual from "./models/IndicatorActual.js";
import { TEMPLATES } from "./data/templates.js";
import { startReminderScheduler } from "./utils/reminders.js";

dotenv.config();

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Vercel filesystem is read-only except /tmp */
if (isServerless && !process.env.UPLOAD_DIR) {
  process.env.UPLOAD_DIR = "/tmp/uploads/evidence";
}

const app = express();
const port = process.env.PORT || 4001;

app.use(cors({ origin: true, credentials: true }));
app.use(morgan(isServerless ? "tiny" : "dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || "uploads/evidence";
app.use("/uploads", express.static(path.resolve(uploadDir, "..")));

let bootstrapped = false;
async function ensureReady() {
  await connectDb();
  if (bootstrapped) return;
  bootstrapped = true;
  await seedTemplatesIfEmpty();
  await syncActualIndexes();
}

app.use(async (req, res, next) => {
  try {
    await ensureReady();
    next();
  } catch (err) {
    next(err);
  }
});

app.use("/api/v1", routes);

app.get("/", (_req, res) => {
  res.json({ status: "success", message: "MERL API", docs: "/api/v1/health" });
});

app.use(notFound);
app.use(globalErrorHandler);

async function seedTemplatesIfEmpty() {
  const count = await Template.countDocuments();
  if (count === 0) {
    await Template.insertMany(TEMPLATES.map((t) => ({ ...t, isPublished: true })));
    console.log(`✓ Seeded ${TEMPLATES.length} sector templates`);
  }
}

/** Drop the legacy unique (indicator, period) index so multiple entries can exist. */
async function syncActualIndexes() {
  try {
    await IndicatorActual.syncIndexes();
  } catch (err) {
    console.warn("⚠️  Could not sync IndicatorActual indexes:", err.message);
  }
}

async function start() {
  await ensureReady();
  startReminderScheduler();
  app.listen(port, () => {
    console.log(`MERL API running on http://localhost:${port}`);
  });
}

// Vercel imports this module via api/index.js — do not listen there
if (!isServerless) {
  start().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}

export default app;
