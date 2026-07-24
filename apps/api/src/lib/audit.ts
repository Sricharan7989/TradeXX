import { auditLog, type Database } from '@tradex/db';

export interface AuditEntry {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * GLOBAL RULE 4: every mutating endpoint writes a row to audit_log. Never
 * throws — an audit-log failure must not fail the user-facing request, but
 * it IS logged loudly so an operator notices.
 */
export async function writeAuditLog(db: Database, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (error) {
    console.error('writeAuditLog: failed to write audit log entry', { entry, error });
  }
}
