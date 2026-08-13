import jwt from "jsonwebtoken";
import { promisify } from "util";
import User from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { hasMinRole } from "../utils/access.js";

export const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) throw new AppError("Please log in to continue", 401);

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).populate("organization");
  if (!user || !user.isActive) {
    throw new AppError("User no longer exists or is inactive", 401);
  }

  req.user = user;
  req.orgId = user.organization?._id || user.organization;
  next();
});

export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission for this action", 403));
    }
    next();
  };

export const requireMinRole = (minRole) => (req, res, next) => {
  if (!hasMinRole(req.user?.role, minRole)) {
    return next(new AppError("You do not have permission for this action", 403));
  }
  next();
};
