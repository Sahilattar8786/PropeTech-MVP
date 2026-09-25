import mongoose, { Schema, type Model } from "mongoose";

/** Adds a required, indexed `tenantId` to every tenant-owned collection. */
export function tenantScoped(schema: Schema, opts: { index?: boolean } = {}) {
  schema.add({ tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: opts.index ?? true } });
}

/** Avoids "OverwriteModelError" when modules are re-evaluated during hot reload. */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export type ObjectId = mongoose.Types.ObjectId;
export const { ObjectId } = mongoose.Types;

export function isObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value);
}
