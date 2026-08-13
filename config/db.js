import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let memoryServer = null;

export async function connectDb() {
  let mongoURL = process.env.MONGODB_URI || process.env.REACT_APP_DEV_DB;

  if (process.env.USE_MEMORY_DB === "true" || !mongoURL) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    mongoURL = memoryServer.getUri();
    console.log("ℹ️  Using in-memory MongoDB (set MONGODB_URI for persistent DB)");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoURL);
  console.log("✅ MongoDB connected");
}

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

export default mongoose;
