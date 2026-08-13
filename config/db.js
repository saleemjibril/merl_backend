import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let memoryServer = null;

/** Reuse connection across warm serverless invocations. */
const globalForMongoose = globalThis;
if (!globalForMongoose.__merlMongoose) {
  globalForMongoose.__merlMongoose = { conn: null, promise: null };
}
const cached = globalForMongoose.__merlMongoose;

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export async function connectDb() {
  if (cached.conn) return cached.conn;
  if (cached.promise) {
    cached.conn = await cached.promise;
    return cached.conn;
  }

  let mongoURL = process.env.MONGODB_URI || process.env.REACT_APP_DEV_DB;
  const wantMemory =
    process.env.USE_MEMORY_DB === "true" || (!mongoURL && !isServerless());

  if (isServerless() && !mongoURL) {
    throw new Error(
      "MONGODB_URI is required on Vercel. In-memory MongoDB is not supported in serverless."
    );
  }

  if (wantMemory && !isServerless()) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    mongoURL = memoryServer.getUri();
    console.log("ℹ️  Using in-memory MongoDB (set MONGODB_URI for persistent DB)");
  }

  if (!mongoURL) {
    throw new Error("MONGODB_URI is not set");
  }

  mongoose.set("strictQuery", true);

  cached.promise = mongoose
    .connect(mongoURL, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    })
    .then((m) => {
      console.log("✅ MongoDB connected");
      return m;
    });

  cached.conn = await cached.promise;
  return cached.conn;
}

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
  cached.conn = null;
  cached.promise = null;
});

export default mongoose;
