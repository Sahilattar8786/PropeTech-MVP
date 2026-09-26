import { logger } from "@/server/lib/logger";
import { DEFAULT_ATTEMPTS, type EnqueueOptions, type JobPayloads, type QueueName } from "./jobs";

/**
 * Queue facade. Producers call `enqueue()` and never know which backend runs the job:
 *  - BullMQ + Redis when REDIS_URL is configured (production; run `npm run worker`).
 *  - An in-process driver otherwise (local development without Redis). It still runs
 *    jobs asynchronously with retries, so request handlers never block on processing.
 */
export interface QueueDriver {
  enqueue<Q extends QueueName>(queue: Q, payload: JobPayloads[Q], opts: Required<Pick<EnqueueOptions, "attempts">> & EnqueueOptions): Promise<void>;
}

// BullMQ holds Redis connections, so it is shared process-wide. The inline driver is
// created per module instance so hot-reloaded processor code is always the code that runs.
const globalForQueue = globalThis as unknown as { __bullmqDriver?: Promise<QueueDriver> };
let inlineDriver: Promise<QueueDriver> | undefined;

function driver(): Promise<QueueDriver> {
  if (process.env.REDIS_URL) {
    globalForQueue.__bullmqDriver ??= import("./bullmq.driver").then(({ BullMQDriver }) => {
      logger.info("Queue: using BullMQ driver");
      return new BullMQDriver(process.env.REDIS_URL!);
    });
    return globalForQueue.__bullmqDriver;
  }
  inlineDriver ??= import("./inline.driver").then(({ InlineDriver }) => {
    logger.info("Queue: REDIS_URL not set — using in-process driver");
    return new InlineDriver();
  });
  return inlineDriver;
}

export async function enqueue<Q extends QueueName>(queue: Q, payload: JobPayloads[Q], opts: EnqueueOptions = {}): Promise<void> {
  const d = await driver();
  await d.enqueue(queue, payload, { attempts: DEFAULT_ATTEMPTS[queue], ...opts });
}
