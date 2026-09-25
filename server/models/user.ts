import { Schema } from "mongoose";
import { defineModel, type ObjectId } from "./_shared";

export const USER_ROLES = ["owner", "admin", "agent"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  image?: string;
  googleId?: string;
  tenantId?: ObjectId;
  role: UserRole;
  platformRole?: "admin";
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    image: String,
    googleId: { type: String, index: { unique: true, sparse: true } },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    role: { type: String, enum: ["owner", "admin", "agent"], default: "owner" },
    platformRole: { type: String, enum: ["admin"] },
    lastLoginAt: Date,
    passwordResetTokenHash: { type: String, select: false, index: { sparse: true } },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

export const User = defineModel<IUser>("User", userSchema);
