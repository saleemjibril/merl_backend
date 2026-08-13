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

const app = express();
const port = process.env.PORT || 4001;

app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || "uploads/evidence";
app.use("/uploads", express.static(path.resolve(uploadDir, "..")));

app.use("/api/v1", routes);

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
  await connectDb();
  await seedTemplatesIfEmpty();
  await syncActualIndexes();
  startReminderScheduler();
  app.listen(port, () => {
    console.log(`MERL API running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
