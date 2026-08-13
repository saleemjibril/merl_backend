import jwt from "jsonwebtoken";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Invite from "../models/Invite.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { logAudit } from "../utils/audit.js";

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, orgId: user.organization },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

export const signup = catchAsync(async (req, res) => {
  const { name, email, password, organizationName, inviteToken } = req.body;
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError("Email already registered", 409);

  let organization;
  let role = "owner";

  if (inviteToken) {
    const invite = await Invite.findOne({
      token: inviteToken,
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!invite) throw new AppError("Invite is invalid or expired", 400);
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new AppError("Invite email does not match", 400);
    }
    organization = await Organization.findById(invite.organization);
    role = invite.role;
    invite.acceptedAt = new Date();
    await invite.save();
  } else {
    const orgName = organizationName || `${name}'s organization`;
    organization = await Organization.create({
      name: orgName,
      plan: "trial",
      planLimits: { maxProjects: null, maxUsers: null },
    });
  }

  const user = await User.create({
    name,
    email,
    password,
    organization: organization._id,
    role,
  });

  await logAudit({
    organization: organization._id,
    actor: user._id,
    action: "user.signup",
    entityType: "User",
    entityId: user._id,
  });

  const token = signToken(user);
  const populated = await User.findById(user._id).populate("organization");

  res.status(201).json({
    status: "success",
    token,
    data: { user: sanitizeUser(populated) },
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError("Email and password required", 400);

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password")
    .populate("organization");
  if (!user || !(await user.correctPassword(password, user.password))) {
    throw new AppError("Incorrect email or password", 401);
  }
  if (!user.isActive) throw new AppError("Account is inactive", 403);

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user);
  res.json({
    status: "success",
    token,
    data: { user: sanitizeUser(user) },
  });
});

export const me = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate("organization");
  res.json({ status: "success", data: { user: sanitizeUser(user) } });
});

export const updateMe = catchAsync(async (req, res) => {
  const { name } = req.body;
  if (name) req.user.name = name;
  await req.user.save();
  const user = await User.findById(req.user._id).populate("organization");
  res.json({ status: "success", data: { user: sanitizeUser(user) } });
});
