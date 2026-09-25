/**
 * Background worker — run alongside the web app when REDIS_URL is configured:
 *   npm run worker
 * Consumes every BullMQ queue and dispatches to the shared processors.
 */
import { Worker } from "bullmq";
import { connectDB } from "@/server/db/connect";
import { logger } from "@/server/lib/logger";
import { createRedisConnection } from "@/server/services/queue/bullmq.driver";
import { QUEUE_NAMES, type QueueName } from "@/server/services/queue/jobs";
import { processors } from "@/server/services/queue/processors";

const CONCURRENCY: Record<QueueName, number> = {
  "whatsapp-message-processing": 5,
  "whatsapp-media-processing": 5,
  "property-ai-processing": 3,
  "property-image-processing": 3,
  "analytics-processing": 10,
};

async function main() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required to run the worker");
  await connectDB();
  const connection = createRedisConnection(url);

  const workers = QUEUE_NAMES.map(
    (name) =>
      new Worker(
        name,
        async (job) => {
          const processor = processors[name] as (payload: unknown, meta: { attempt: number; maxAttempts: number }) => Promise<void>;
          await processor(job.data, { attempt: job.attemptsMade + 1, maxAttempts: job.opts.attempts ?? 1 });
        },
        { connection, concurrency: CONCURRENCY[name] },
      ),
  );

  for (const worker of workers) {
    worker.on("failed", (job, error) => logger.warn(`[${worker.name}] job ${job?.id} failed: ${error.message}`));
    worker.on("error", (error) => logger.error(`[${worker.name}] worker error`, error));
  }
  logger.info(`PropFlow worker running: ${QUEUE_NAMES.join(", ")}`);

  const shutdown = async () => {
    logger.info("Shutting down workers…");
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error("Worker failed to start", error);
  process.exit(1);
});
