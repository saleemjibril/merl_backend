import Reminder from "../models/Reminder.js";
import Indicator from "../models/Indicator.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";
import { logAudit } from "../utils/audit.js";

export const listReminders = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const reminders = await Reminder.find({ project: req.params.projectId })
    .populate("indicator", "name")
    .populate("period", "name")
    .populate("createdBy", "name")
    .sort({ dueAt: 1 });
  res.json({ status: "success", data: { reminders } });
});

export const createReminder = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);

  const { message, dueAt, indicatorId, periodId } = req.body;
  if (!message || !dueAt) {
    throw new AppError("message and dueAt are required", 400);
  }

  let indicator = null;
  if (indicatorId) {
    indicator = await Indicator.findOne({
      _id: indicatorId,
      project: req.params.projectId,
    });
    if (!indicator) throw new AppError("Indicator not found", 404);
  }

  const reminder = await Reminder.create({
    organization: req.orgId,
    project: req.params.projectId,
    indicator: indicator?._id || null,
    period: periodId || null,
    message,
    dueAt: new Date(dueAt),
    createdBy: req.user._id,
  });

  await logAudit({
    organization: req.orgId,
    project: req.params.projectId,
    actor: req.user._id,
    action: "reminder.created",
    entityType: "Reminder",
    entityId: reminder._id,
    meta: { message, dueAt },
  });

  const populated = await Reminder.findById(reminder._id)
    .populate("indicator", "name")
    .populate("period", "name")
    .populate("createdBy", "name");
  res.status(201).json({ status: "success", data: { reminder: populated } });
});

export const deleteReminder = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const reminder = await Reminder.findOne({
    _id: req.params.reminderId,
    project: req.params.projectId,
  });
  if (!reminder) throw new AppError("Reminder not found", 404);
  await reminder.deleteOne();
  res.json({ status: "success", message: "Reminder deleted" });
});
