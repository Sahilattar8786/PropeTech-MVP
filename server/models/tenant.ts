import { Schema } from "mongoose";
import { defineModel, type ObjectId } from "./_shared";

export interface ITenant {
  _id: ObjectId;
  name: string;
  ownerId: ObjectId;
  status: "active" | "suspended";
  /** Monotonic counter used to generate human-friendly property IDs (REH-1024). */
  propertySeq: number;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    propertySeq: { type: Number, default: 1000 },
  },
  { timestamps: true },
);

export const Tenant = defineModel<ITenant>("Tenant", tenantSchema);
