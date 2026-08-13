import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Invite from "../models/Invite.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole } from "../utils/access.js";
import { logAudit } from "../utils/audit.js";

export const getOrganization = catchAsync(async (req, res) => {
  const org = await Organization.findById(req.orgId);
  const members = await User.find({ organization: req.orgId })
    .select("-password")
    .sort({ createdAt: 1 });
  res.json({ status: "success", data: { organization: org, members } });
});

export const updateOrganization = catchAsync(async (req, res) => {
  assertRole(req.user, "owner");
  const org = await Organization.findById(req.orgId);
  if (!org) throw new AppError("Organization not found", 404);
  if (req.body.name) org.name = req.body.name;
  await org.save();
  res.json({ status: "success", data: { organization: org } });
});

export const inviteMember = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const { email, role = "contributor" } = req.body;
  if (!email) throw new AppError("Email is required", 400);
  if (!["coordinator", "contributor", "viewer"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError("User already has an account", 409);

  const token = Invite.createToken();
  const invite = await Invite.create({
    organization: req.orgId,
    email,
    role,
    token,
    invitedBy: req.user._id,
  });

  await logAudit({
    organization: req.orgId,
    actor: req.user._id,
    action: "invite.created",
    entityType: "Invite",
    entityId: invite._id,
    meta: { email, role },
  });

  const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/signup?invite=${token}`;

  res.status(201).json({
    status: "success",
    data: { invite, inviteUrl },
  });
});

/** Owner/coordinator creates a member account directly with a password. */
export const createMember = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const { name, email, password, role = "contributor" } = req.body;
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }
  if (!["coordinator", "contributor", "viewer"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError("A user with that email already exists", 409);

  const member = await User.create({
    organization: req.orgId,
    name,
    email,
    password,
    role,
  });

  await logAudit({
    organization: req.orgId,
    actor: req.user._id,
    action: "member.created",
    entityType: "User",
    entityId: member._id,
    meta: { email, role },
  });

  const safe = member.toObject();
  delete safe.password;
  res.status(201).json({ status: "success", data: { user: safe } });
});

export const listInvites = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const invites = await Invite.find({
    organization: req.orgId,
    acceptedAt: null,
  }).sort({ createdAt: -1 });
  res.json({ status: "success", data: { invites } });
});

export const updateMemberRole = catchAsync(async (req, res) => {
  assertRole(req.user, "owner");
  const { role } = req.body;
  if (!["coordinator", "contributor", "viewer"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }
  const member = await User.findOne({
    _id: req.params.userId,
    organization: req.orgId,
  });
  if (!member) throw new AppError("Member not found", 404);
  if (member.role === "owner") throw new AppError("Cannot change owner role", 400);
  member.role = role;
  await member.save();
  res.json({ status: "success", data: { user: member } });
});

/**
 * Suspend/reactivate a member.
 * - Owner may change coordinator, contributor, viewer
 * - Coordinator may change contributor, viewer
 * - Nobody may change the owner or themselves
 */
export const setMemberActive = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    throw new AppError("isActive (boolean) is required", 400);
  }

  const member = await User.findOne({
    _id: req.params.userId,
    organization: req.orgId,
  });
  if (!member) throw new AppError("Member not found", 404);
  if (String(member._id) === String(req.user._id)) {
    throw new AppError("You cannot change your own account status", 400);
  }
  if (member.role === "owner") {
    throw new AppError("Cannot change the owner account", 400);
  }

  const actorIsOwner = req.user.role === "owner";
  if (!actorIsOwner) {
    // Coordinators may only manage contributors and viewers
    if (!["contributor", "viewer"].includes(member.role)) {
      throw new AppError("Coordinators can only suspend/reactivate contributors", 403);
    }
  }

  member.isActive = isActive;
  await member.save();

  await logAudit({
    organization: req.orgId,
    actor: req.user._id,
    action: isActive ? "member.reactivated" : "member.suspended",
    entityType: "User",
    entityId: member._id,
    meta: { email: member.email, role: member.role },
  });

  const safe = member.toObject();
  delete safe.password;
  res.json({ status: "success", data: { user: safe } });
});

/** Billing stub — plan label only; limits are disabled for now. */
export const updatePlan = catchAsync(async (req, res) => {
  assertRole(req.user, "owner");
  const { plan } = req.body;
  const allowed = ["trial", "solo", "team", "org"];
  if (!allowed.includes(plan)) throw new AppError("Invalid plan", 400);
  const org = await Organization.findById(req.orgId);
  org.plan = plan;
  org.planLimits = { maxProjects: null, maxUsers: null };
  await org.save();
  await logAudit({
    organization: req.orgId,
    actor: req.user._id,
    action: "billing.plan_updated",
    entityType: "Organization",
    entityId: org._id,
    meta: { plan },
  });
  res.json({ status: "success", data: { organization: org } });
});
