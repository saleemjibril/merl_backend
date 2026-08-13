import dotenv from "dotenv";
import { connectDb } from "../config/db.js";
import Template from "../models/Template.js";
import { TEMPLATES } from "./templates.js";

dotenv.config();

async function main() {
  await connectDb();
  for (const t of TEMPLATES) {
    await Template.findOneAndUpdate(
      { key: t.key },
      { ...t, isPublished: true },
      { upsert: true, new: true }
    );
    console.log(`✓ seeded template: ${t.key}`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
