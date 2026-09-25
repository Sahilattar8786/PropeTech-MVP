import { logger } from "@/server/lib/logger";
import { AuditLog } from "@/server/models";

export interface AuditActor {
  tenantId: string;
  userId?: string;
}

/** Append-only audit trail for security-relevant changes. Failures are logged, never thrown. */
export async function audit(
  actor: AuditActor,
  action: string,
  entity: { type: string; id?: string },
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action,
      entityType: entity.type,
      entityId: entity.id,
      metadata,
    });
  } catch (error) {
    logger.warn(`audit(${action}) failed`, error);
  }
}
