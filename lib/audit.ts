import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the provided data object for audit integrity.
 */
export function generateHash(data: any): string {
  const jsonStr = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

export interface AuditEntryParams {
  action: string;
  actorId: string; // e.g. "AI_SYSTEM" or user ID
  resourceId: string;
  details: Record<string, any>;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  actorId: string;
  resourceId: string;
  details: string; // JSON stringified
  dataHash: string; // Hash for tamper detection
}

/**
 * Creates an immutable audit record payload.
 */
export function createAuditEntry(params: AuditEntryParams): AuditRecord {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const payload = {
    action: params.action,
    actorId: params.actorId,
    resourceId: params.resourceId,
    details: params.details,
    timestamp
  };

  return {
    id,
    timestamp,
    action: params.action,
    actorId: params.actorId,
    resourceId: params.resourceId,
    details: JSON.stringify(params.details),
    dataHash: generateHash(payload)
  };
}
