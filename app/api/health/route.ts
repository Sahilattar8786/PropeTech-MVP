import mongoose from "mongoose";
import { connectDB } from "@/server/db/connect";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    return Response.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "up" : "down" });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
