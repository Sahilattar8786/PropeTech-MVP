import mongoose from "mongoose";
import { env } from "@/server/lib/env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = globalForMongoose.__mongoose ?? { conn: null, promise: null };
globalForMongoose.__mongoose = cache;

mongoose.set("strictQuery", true);

/** Reuses a single connection across hot reloads and serverless invocations. */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(env().DATABASE_URL, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        autoIndex: process.env.NODE_ENV !== "production",
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
