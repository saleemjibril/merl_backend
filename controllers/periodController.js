import ReportingPeriod from "../models/ReportingPeriod.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";
import { periodLifecycleStatus, getDeadlineCountdown } from "../utils/progress.js";
import { logAudit } from "../utils/audit.js";

export const listPeriods = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const periods = await ReportingPeriod.find({
    project: req.params.projectId,
  }).sort({ startDate: 1 });

  const data = periods.map((p) => ({
    ...p.toObject(),
    lifecycle: periodLifecycleStatus(p),
    countdown: getDeadlineCountdown(p.endDate),
  }));

  res.json({ status: "success", data: { periods: data } });
});

export const createPeriod = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const { name, startDate, endDate, status } = req.body;
  if (!name || !startDate || !endDate) {
    throw new AppError("name, startDate, and endDate are required", 400);
  }
  if (new Date(endDate) < new Date(startDate)) {
    throw new AppError("endDate must be after startDate", 400);
  }

  const period = await ReportingPeriod.create({
    project: req.params.projectId,
    name,
    startDate,
    endDate,
    status: status || "open",
  });

  res.status(201).json({ status: "success", data: { period } });
});

export const updatePeriod = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const period = await ReportingPeriod.findOne({
    _id: req.params.periodId,
    project: req.params.projectId,
  });
  if (!period) throw new AppError("Period not found", 404);

  for (const f of ["name", "startDate", "endDate", "status"]) {
    if (req.body[f] !== undefined) period[f] = req.body[f];
  }
  await period.save();
  res.json({ status: "success", data: { period } });
});

export const lockPeriod = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const period = await ReportingPeriod.findOne({
    _id: req.params.periodId,
    project: req.params.projectId,
  });
  if (!period) throw new AppError("Period not found", 404);
  period.status = "locked";
  await period.save();
  await logAudit({
    organization: req.orgId,
    project: req.params.projectId,
    actor: req.user._id,
    action: "period.locked",
    entityType: "ReportingPeriod",
    entityId: period._id,
  });
  res.json({ status: "success", data: { period } });
});

export const deletePeriod = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const period = await ReportingPeriod.findOneAndDelete({
    _id: req.params.periodId,
    project: req.params.projectId,
  });
  if (!period) throw new AppError("Period not found", 404);
  res.json({ status: "success", message: "Period deleted" });
});
