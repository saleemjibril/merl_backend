import AuditLog from "../models/AuditLog.js";

export async function logAudit({
  organization,
  project,
  actor,
  action,
  entityType,
  entityId,
  meta = {},
}) {
  try {
    await AuditLog.create({
      organization,
      project,
      actor,
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      meta,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}
