import mongoose from "mongoose";

// Serverless functions can spin up many concurrent instances; without
// caching, each cold start opens a fresh connection and you blow through
// your MongoDB Atlas connection limit. Cache the promise on `global` so
// warm invocations reuse the same connection.
let cached = global._mongooseConn;

if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI)
      .then((mongooseInstance) => {
        console.log("db connected successfully");
        return mongooseInstance;
      })
      .catch((error) => {
        console.log("db connection error", error.message);
        cached.promise = null; // allow retry on next call
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}