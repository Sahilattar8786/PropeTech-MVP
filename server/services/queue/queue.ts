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

const globalForQueue = globalThis as unknown as { __queueDriver?: Promise<QueueDriver> };

async function createDriver(): Promise<QueueDriver> {
  if (process.env.REDIS_URL) {
    const { BullMQDriver } = await import("./bullmq.driver");
    logger.info("Queue: using BullMQ driver");
    return new BullMQDriver(process.env.REDIS_URL);
  }
  const { InlineDriver } = await import("./inline.driver");
  logger.info("Queue: REDIS_URL not set — using in-process driver");
  return new InlineDriver();
}

function driver(): Promise<QueueDriver> {
  globalForQueue.__queueDriver ??= createDriver();
  return globalForQueue.__queueDriver;
}

export async function enqueue<Q extends QueueName>(queue: Q, payload: JobPayloads[Q], opts: EnqueueOptions = {}): Promise<void> {
  const d = await driver();
  await d.enqueue(queue, payload, { attempts: DEFAULT_ATTEMPTS[queue], ...opts });
}
