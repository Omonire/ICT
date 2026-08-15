import { AppDataSource } from '../config/data-source';
import { ActivityLog } from '../entities/ActivityLog';
import { genUuid } from '../utils/ids';

export interface LogInput {
  action: string;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logActivity(input: LogInput): Promise<ActivityLog> {
  const repo = AppDataSource.getRepository(ActivityLog);
  const entry = repo.create({
    id: genUuid(),
    action: input.action,
    userId: input.userId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    details: input.details ?? null,
  });
  return repo.save(entry);
}
