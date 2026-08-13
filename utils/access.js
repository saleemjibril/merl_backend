import Project from "../models/Project.js";
import AppError from "./AppError.js";

const ROLE_RANK = {
  viewer: 1,
  contributor: 2,
  coordinator: 3,
  owner: 4,
};

export function hasMinRole(userRole, minRole) {
  return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[minRole] || 0);
}

export async function getOrgProject(projectId, orgId) {
  const project = await Project.findOne({
    _id: projectId,
    organization: orgId,
  });
  if (!project) throw new AppError("Project not found", 404);
  return project;
}

export function assertRole(user, minRole) {
  if (!hasMinRole(user.role, minRole)) {
    throw new AppError("You do not have permission for this action", 403);
  }
}

/** Plan caps disabled for now — kept for future billing. */
export const PLAN_LIMITS = {
  trial: { maxProjects: null, maxUsers: null },
  solo: { maxProjects: null, maxUsers: null },
  team: { maxProjects: null, maxUsers: null },
  org: { maxProjects: null, maxUsers: null },
};
