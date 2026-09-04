export interface SLAInfo {
  ageHours: number;
  isSLABreach: boolean;
  ttlRemainingHours: number;
  slaTag: string;
  severityEscalated: boolean;
}

const DEFAULT_SLA_TTL_HOURS = 48; // 48 hours SLA TTL

/**
 * Evaluates the SLA Aging status of an exception.
 * Escalates severity to CRITICAL if unresolved > 48 hours.
 */
export function evaluateSLA(createdAt: Date | string | null | undefined, currentSeverity: string): SLAInfo {
  if (!createdAt) {
    return {
      ageHours: 0,
      isSLABreach: false,
      ttlRemainingHours: DEFAULT_SLA_TTL_HOURS,
      slaTag: 'Age: <1h',
      severityEscalated: false,
    };
  }

  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - createdTime;
  const ageHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  const isSLABreach = ageHours >= DEFAULT_SLA_TTL_HOURS;
  const ttlRemainingHours = Math.max(0, DEFAULT_SLA_TTL_HOURS - ageHours);

  let slaTag = `Age: ${ageHours}h`;
  if (isSLABreach) {
    slaTag = `CRITICAL: ${ageHours}h (SLA Breach)`;
  }

  return {
    ageHours,
    isSLABreach,
    ttlRemainingHours,
    slaTag,
    severityEscalated: isSLABreach && currentSeverity !== 'CRITICAL',
  };
}
