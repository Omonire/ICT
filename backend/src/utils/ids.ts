import crypto from 'crypto';

export const genUuid = (): string => crypto.randomUUID();

export const CANDIDATE_ID_PREFIX = 'CAN';

export function nextCandidateId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const match = /^CAN-(\d+)$/.exec(id);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${CANDIDATE_ID_PREFIX}-${String(max + 1).padStart(5, '0')}`;
}

export function isCandidateId(value: string): boolean {
  return /^CAN-\d+$/.test(value);
}
