import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { EnqueueOptions, JobPayloads, QueueName } from "./jobs";
import type { QueueDriver } from "./queue";

export function createRedisConnection(url: string) {
  // BullMQ requires maxRetriesPerRequest: null for blocking commands used by workers.
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export class BullMQDriver implements QueueDriver {
  private queues = new Map<QueueName, Queue>();
  private connection: IORedis;

  constructor(url: string) {
    this.connection = createRedisConnection(url);
  }

  private queue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<Q extends QueueName>(name: Q, payload: JobPayloads[Q], opts: EnqueueOptions & { attempts: number }) {
    await this.queue(name).add(name, payload, {
      jobId: opts.jobId,
      delay: opts.delayMs,
      attempts: opts.attempts,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });
  }
}
