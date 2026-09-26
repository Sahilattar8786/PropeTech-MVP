#!/usr/bin/env node
/**
 * Rewrites stored media URLs from one public base to another — e.g. after fixing
 * S3_PUBLIC_URL, or moving from an r2.dev address to a custom domain (media.yourdomain.com).
 * Updates media records, property photos and broker logos/profile photos.
 *
 *   node --env-file=.env.production scripts/rewrite-media-urls.mjs \
 *     --from https://pub-OLD.r2.dev --to https://pub-NEW.r2.dev --dry-run
 *
 * Run without --dry-run to apply. Only URLs starting with --from are changed; re-running is safe.
 * The files themselves are not moved. By default a URL is only rewritten if its file exists in
 * S3_BUCKET (from the env file), so records belonging to another bucket are left alone.
 * Pass --no-verify to skip that check.
 */
import { AwsClient } from "aws4fetch";
import mongoose from "mongoose";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]?.replace(/\/+$/, "") : undefined;
};
const from = option("from");
const to = option("to");
const dryRun = args.includes("--dry-run");
const verify = !args.includes("--no-verify");

if (!from || !to || !/^https?:\/\//.test(from) || !/^https?:\/\//.test(to)) {
  console.error("Usage: node --env-file=<env file> scripts/rewrite-media-urls.mjs --from <old base URL> --to <new base URL> [--dry-run]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set — pass --env-file=.env.production (or .env.local) to node.");
  process.exit(1);
}

const prefix = `${from}/`;
const e = process.env;
if (verify && !(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY)) {
  console.error("Verification needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in the env file (or pass --no-verify).");
  process.exit(1);
}
const s3 = verify ? new AwsClient({ accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY, region: e.S3_REGION || "auto", service: "s3" }) : null;
const existsCache = new Map();
/** Does the object behind this URL exist in S3_BUCKET? */
async function inBucket(url) {
  if (!verify) return true;
  const key = url.slice(prefix.length);
  if (!existsCache.has(key)) {
    const res = await s3.fetch(`${e.S3_ENDPOINT.replace(/\/+$/, "")}/${e.S3_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD" });
    existsCache.set(key, res.status === 200);
  }
  return existsCache.get(key);
}
/** Rewritten URL, or the original when it doesn't match or its file isn't in this bucket. */
async function swap(url) {
  if (typeof url !== "string" || !url.startsWith(prefix) || !(await inBucket(url))) return url;
  return `${to}/${url.slice(prefix.length)}`;
}
const startsWithPrefix = { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` };

await mongoose.connect(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 10_000 });
const db = mongoose.connection.db;
console.log(`${dryRun ? "[dry run] " : ""}database "${db.databaseName}": ${from} → ${to}${verify ? ` (only files present in bucket "${e.S3_BUCKET}")` : ""}\n`);

const media = await db.collection("media").find({ url: startsWithPrefix }).project({ url: 1 }).toArray();
const properties = await db.collection("properties").find({ images: startsWithPrefix }).project({ images: 1 }).toArray();
const brokers = await db
  .collection("brokers")
  .find({ $or: [{ logoUrl: startsWithPrefix }, { profileImageUrl: startsWithPrefix }] })
  .project({ logoUrl: 1, profileImageUrl: 1 })
  .toArray();

// Work out every change first, so dry runs report exactly what would happen.
const mediaUpdates = [];
for (const m of media) {
  const url = await swap(m.url);
  if (url !== m.url) mediaUpdates.push({ updateOne: { filter: { _id: m._id }, update: { $set: { url } } } });
}
let photoCount = 0;
const propertyUpdates = [];
for (const p of properties) {
  const images = [];
  for (const u of p.images) images.push(await swap(u));
  const changed = images.filter((u, i) => u !== p.images[i]).length;
  if (changed) {
    photoCount += changed;
    propertyUpdates.push({ updateOne: { filter: { _id: p._id }, update: { $set: { images } } } });
  }
}
const brokerUpdates = [];
for (const b of brokers) {
  const logoUrl = await swap(b.logoUrl);
  const profileImageUrl = await swap(b.profileImageUrl);
  if (logoUrl !== b.logoUrl || profileImageUrl !== b.profileImageUrl) brokerUpdates.push({ updateOne: { filter: { _id: b._id }, update: { $set: { logoUrl, profileImageUrl } } } });
}

console.log(`  media records:   ${mediaUpdates.length} of ${media.length} matching`);
console.log(`  properties:      ${propertyUpdates.length} (${photoCount} photos)`);
console.log(`  broker branding: ${brokerUpdates.length}`);

if (!dryRun) {
  if (mediaUpdates.length) await db.collection("media").bulkWrite(mediaUpdates);
  if (propertyUpdates.length) await db.collection("properties").bulkWrite(propertyUpdates);
  if (brokerUpdates.length) await db.collection("brokers").bulkWrite(brokerUpdates);
  console.log("\n✓ Updated. Public listing pages refresh within 5 minutes (or redeploy to refresh immediately).");
}
await mongoose.disconnect();
