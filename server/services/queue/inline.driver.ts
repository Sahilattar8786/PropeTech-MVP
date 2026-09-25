import { logger } from "@/server/lib/logger";
import type { EnqueueOptions, JobPayloads, QueueName } from "./jobs";
import type { QueueDriver } from "./queue";

const BACKOFF_MS = 2000;

/** Development-only driver: runs jobs in this process on a timer, with retries and de-duplication. */
export class InlineDriver implements QueueDriver {
  private pending = new Set<string>();

  async enqueue<Q extends QueueName>(queue: Q, payload: JobPayloads[Q], opts: EnqueueOptions & { attempts: number }) {
    const key = opts.jobId ? `${queue}:${opts.jobId}` : null;
    if (key) {
      if (this.pending.has(key)) return;
      this.pending.add(key);
    }
    setTimeout(() => void this.run(queue, payload, opts.attempts, 1, key), opts.delayMs ?? 0);
  }

  private async run<Q extends QueueName>(queue: Q, payload: JobPayloads[Q], maxAttempts: number, attempt: number, key: string | null) {
    try {
      const { processors } = await import("./processors");
      if (key) this.pending.delete(key);
      await processors[queue](payload, { attempt, maxAttempts });
    } catch (error) {
      if (attempt < maxAttempts) {
        logger.warn(`Job ${queue} failed (attempt ${attempt}/${maxAttempts}), retrying`, error);
        setTimeout(() => void this.run(queue, payload, maxAttempts, attempt + 1, null), BACKOFF_MS * 2 ** (attempt - 1));
      } else {
        logger.error(`Job ${queue} failed permanently`, error);
      }
    }
  }
}
