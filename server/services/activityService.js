import ActivityLog from '../models/ActivityLog.js';
export async function logActivity({ organizationId, actorId, action, entityType = '', entityId = '', summary, metadata = {} }) {
  return ActivityLog.create({ organizationId, actorId, action, entityType, entityId: String(entityId || ''), summary, metadata });
}
