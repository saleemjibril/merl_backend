import IndicatorActual from "../models/IndicatorActual.js";
import Indicator from "../models/Indicator.js";
import IndicatorTarget from "../models/IndicatorTarget.js";
import ReportingPeriod from "../models/ReportingPeriod.js";
import Evidence from "../models/Evidence.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject, hasMinRole } from "../utils/access.js";
import { computeProgress, aggregateEntries } from "../utils/progress.js";
import { logAudit } from "../utils/audit.js";
import { notifyUsers, orgReviewerIds } from "../utils/notify.js";

export const listActuals = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const filter = { project: req.params.projectId };
  if (req.query.periodId) filter.period = req.query.periodId;
  if (req.query.status) filter.status = req.query.status;

  const actuals = await IndicatorActual.find(filter)
    .populate("indicator")
    .populate("period", "name startDate endDate status")
    .populate("enteredBy", "name email")
    .populate("reviewedBy", "name email");

  const evidenceCounts = await Evidence.aggregate([
    {
      $match: {
        indicatorActual: { $in: actuals.map((a) => a._id) },
      },
    },
    { $group: { _id: "$indicatorActual", count: { $sum: 1 } } },
  ]);
  const eMap = Object.fromEntries(evidenceCounts.map((e) => [String(e._id), e.count]));

  const targets = await IndicatorTarget.find({
    project: req.params.projectId,
    ...(req.query.periodId ? { period: req.query.periodId } : {}),
  });
  const tMap = Object.fromEntries(
    targets.map((t) => [`${t.indicator}_${t.period}`, t])
  );

  const data = actuals.map((a) => {
    const ind = a.indicator;
    const t = tMap[`${a.indicator?._id || a.indicator}_${a.period?._id || a.period}`];
    const progress = ind
      ? computeProgress({
          baseline: ind.baselineValue,
          target: t?.targetValue,
          actual: a.value,
          direction: ind.direction,
        })
      : null;
    return {
      ...a.toObject(),
      target: t || null,
      progress,
      evidenceCount: eMap[String(a._id)] || 0,
    };
  });

  res.json({ status: "success", data: { actuals: data } });
});

/** Matrix for data entry: all indicators × one period, each with its entries. */
export const getEntryMatrix = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const { periodId } = req.query;
  if (!periodId) throw new AppError("periodId is required", 400);

  const period = await ReportingPeriod.findOne({
    _id: periodId,
    project: req.params.projectId,
  });
  if (!period) throw new AppError("Period not found", 404);

  const indicators = await Indicator.find({
    project: req.params.projectId,
    isActive: true,
  })
    .populate("resultNode", "title level")
    .sort({ sortOrder: 1 });

  const targets = await IndicatorTarget.find({
    project: req.params.projectId,
    period: periodId,
  });
  const entries = await IndicatorActual.find({
    project: req.params.projectId,
    period: periodId,
  })
    .populate("enteredBy", "name email")
    .sort({ createdAt: 1 });

  const evidenceCounts = await Evidence.aggregate([
    { $match: { indicatorActual: { $in: entries.map((e) => e._id) } } },
    { $group: { _id: "$indicatorActual", count: { $sum: 1 } } },
  ]);
  const evMap = Object.fromEntries(
    evidenceCounts.map((e) => [String(e._id), e.count])
  );

  const tMap = Object.fromEntries(targets.map((t) => [String(t.indicator), t]));
  const entriesByIndicator = {};
  for (const e of entries) {
    const key = String(e.indicator);
    (entriesByIndicator[key] = entriesByIndicator[key] || []).push(e);
  }

  const rows = indicators.map((ind) => {
    const t = tMap[String(ind._id)];
    const list = entriesByIndicator[String(ind._id)] || [];
    const agg = aggregateEntries(list);
    const progress = computeProgress({
      baseline: ind.baselineValue,
      target: t?.targetValue,
      actual: agg.value,
      direction: ind.direction,
    });
    return {
      indicator: ind,
      target: t || null,
      aggregate: {
        value: agg.value,
        pendingValue: agg.pendingValue,
        status: agg.status,
        counts: agg.counts,
      },
      progress,
      entries: list.map((e) => ({
        _id: e._id,
        value: e.value,
        narrative: e.narrative,
        status: e.status,
        enteredBy: e.enteredBy
          ? { _id: e.enteredBy._id, name: e.enteredBy.name, email: e.enteredBy.email }
          : null,
        rejectionReason: e.rejectionReason,
        submittedAt: e.submittedAt,
        createdAt: e.createdAt,
        evidenceCount: evMap[String(e._id)] || 0,
      })),
    };
  });

  res.json({ status: "success", data: { period, rows } });
});

/** Create a new contribution entry against an indicator for a period. */
export const createEntry = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  await getOrgProject(req.params.projectId, req.orgId);

  const { indicatorId, periodId, value, textValue, narrative } = req.body;
  if (!indicatorId || !periodId) {
    throw new AppError("indicatorId and periodId are required", 400);
  }

  const period = await ReportingPeriod.findOne({
    _id: periodId,
    project: req.params.projectId,
  });
  if (!period) throw new AppError("Period not found", 404);
  if (period.status === "locked") throw new AppError("Period is locked", 400);

  const indicator = await Indicator.findOne({
    _id: indicatorId,
    project: req.params.projectId,
  });
  if (!indicator) throw new AppError("Indicator not found", 404);

  const actual = await IndicatorActual.create({
    indicator: indicatorId,
    period: periodId,
    project: req.params.projectId,
    value: value === null || value === "" || value === undefined ? null : Number(value),
    textValue: textValue || "",
    narrative: narrative || "",
    enteredBy: req.user._id,
    status: "draft",
  });

  await logAudit({
    organization: req.orgId,
    project: req.params.projectId,
    actor: req.user._id,
    action: "actual.created",
    entityType: "IndicatorActual",
    entityId: actual._id,
  });

  const populated = await actual.populate("enteredBy", "name email");
  res.status(201).json({ status: "success", data: { actual: populated } });
});

/** Edit an existing entry. Owner may edit their own draft/rejected; coordinators any. */
export const updateEntry = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  await getOrgProject(req.params.projectId, req.orgId);

  const actual = await IndicatorActual.findOne({
    _id: req.params.actualId,
    project: req.params.projectId,
  });
  if (!actual) throw new AppError("Entry not found", 404);

  const period = await ReportingPeriod.findById(actual.period);
  if (period?.status === "locked") throw new AppError("Period is locked", 400);

  const isCoordinator = hasMinRole(req.user.role, "coordinator");
  const isOwner = String(actual.enteredBy) === String(req.user._id);
  if (!isCoordinator && !isOwner) {
    throw new AppError("You can only edit your own entries", 403);
  }
  if (!isCoordinator && ["submitted", "approved"].includes(actual.status)) {
    throw new AppError("Submitted entries can only be changed by a coordinator", 403);
  }

  const { value, textValue, narrative } = req.body;
  if (value !== undefined) {
    actual.value = value === null || value === "" ? null : Number(value);
  }
  if (textValue !== undefined) actual.textValue = textValue;
  if (narrative !== undefined) actual.narrative = narrative;
  if (actual.status === "rejected") actual.status = "draft";
  await actual.save();

  const populated = await actual.populate("enteredBy", "name email");
  res.json({ status: "success", data: { actual: populated } });
});

/** Delete an entry (and its evidence). Owner while draft/rejected, or coordinator. */
export const deleteEntry = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  await getOrgProject(req.params.projectId, req.orgId);

  const actual = await IndicatorActual.findOne({
    _id: req.params.actualId,
    project: req.params.projectId,
  });
  if (!actual) throw new AppError("Entry not found", 404);

  const isCoordinator = hasMinRole(req.user.role, "coordinator");
  const isOwner = String(actual.enteredBy) === String(req.user._id);
  if (!isCoordinator && !isOwner) {
    throw new AppError("You can only delete your own entries", 403);
  }
  if (!isCoordinator && ["submitted", "approved"].includes(actual.status)) {
    throw new AppError("Submitted entries can only be removed by a coordinator", 403);
  }

  await Evidence.deleteMany({ indicatorActual: actual._id });
  await actual.deleteOne();

  await logAudit({
    organization: req.orgId,
    project: req.params.projectId,
    actor: req.user._id,
    action: "actual.deleted",
    entityType: "IndicatorActual",
    entityId: actual._id,
  });

  res.json({ status: "success", message: "Entry deleted" });
});

export const submitActual = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  await getOrgProject(req.params.projectId, req.orgId);
  const actual = await IndicatorActual.findOne({
    _id: req.params.actualId,
    project: req.params.projectId,
  }).populate("indicator");
  if (!actual) throw new AppError("Actual not found", 404);

  const period = await ReportingPeriod.findById(actual.period);
  if (period?.status === "locked") throw new AppError("Period is locked", 400);

  if (actual.indicator?.requiresEvidence) {
    const count = await Evidence.countDocuments({ indicatorActual: actual._id });
    if (count < 1) throw new AppError("Evidence is required before submit", 400);
  }

  const autoApprove = hasMinRole(req.user.role, "coordinator");
  actual.submittedAt = new Date();

  if (autoApprove) {
    // Owners and coordinators don't need review — their entries count immediately.
    actual.status = "approved";
    actual.reviewedBy = req.user._id;
    actual.reviewedAt = new Date();
    actual.rejectionReason = "";
    await actual.save();

    await logAudit({
      organization: req.orgId,
      project: req.params.projectId,
      actor: req.user._id,
      action: "actual.auto_approved",
      entityType: "IndicatorActual",
      entityId: actual._id,
    });

    return res.json({ status: "success", data: { actual, autoApproved: true } });
  }

  actual.status = "submitted";
  await actual.save();

  await logAudit({
    organization: req.orgId,
    project: req.params.projectId,
    actor: req.user._id,
    action: "actual.submitted",
    entityType: "IndicatorActual",
    entityId: actual._id,
  });

  // Notify reviewers (owner/coordinator) that an entry needs review.
  const reviewers = (await orgReviewerIds(req.orgId)).filter(
    (uid) => String(uid) !== String(req.user._id)
  );
  await notifyUsers(reviewers, {
    organization: req.orgId,
    project: req.params.projectId,
    type: "submission",
    title: "Entry submitted for review",
    body: `${req.user.name} submitted an entry for "${actual.indicator?.name || "an indicator"}".`,
    link: `/projects/${req.params.projectId}/data-entry?tab=submitted&entryId=${actual._id}&periodId=${actual.period}`,
  });

  res.json({ status: "success", data: { actual, autoApproved: false } });
});

export const reviewActual = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const { decision, rejectionReason } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    throw new AppError("decision must be approved or rejected", 400);
  }
  if (decision === "rejected" && !String(rejectionReason || "").trim()) {
    throw new AppError("A rejection reason is required", 400);
  }

  const actual = await IndicatorActual.findOne({
    _id: req.params.actualId,
    project: req.params.projectId,
  }).populate("indicator", "name");
  if (!actual) throw new AppError("Actual not found", 404);
  if (actual.status !== "submitted") {
    throw new AppError("Only submitted actuals can be reviewed", 400);
  }

  actual.status = decision;
  actual.reviewedBy = req.user._id;
  actual.reviewedAt = new Date();
  actual.rejectionReason = decision === "rejected" ? rejectionReason || "" : "";
  await actual.save();

  await logAudit({
    organization: req.orgId,
    project: req.params.projectId,
    actor: req.user._id,
    action: `actual.${decision}`,
    entityType: "IndicatorActual",
    entityId: actual._id,
    meta: { rejectionReason },
  });

  // Notify the contributor who entered it.
  if (actual.enteredBy) {
    const indName = actual.indicator?.name || "an indicator";
    await notifyUsers([actual.enteredBy], {
      organization: req.orgId,
      project: req.params.projectId,
      type: "review",
      title: decision === "approved" ? "Entry approved" : "Entry rejected",
      body:
        decision === "approved"
          ? `Your entry for "${indName}" was approved.`
          : `Your entry for "${indName}" was rejected${
              actual.rejectionReason ? `: ${actual.rejectionReason}` : ""
            }.`,
      link: `/projects/${req.params.projectId}/data-entry?tab=submitted&entryId=${actual._id}&periodId=${actual.period}`,
    });
  }

  res.json({ status: "success", data: { actual } });
});

export const reviewQueue = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const filter = {
    organization: undefined,
  };
  // Actuals don't store org — filter via projects
  const projects = await (
    await import("../models/Project.js")
  ).default.find({ organization: req.orgId }).select("_id");
  const projectIds = projects.map((p) => p._id);

  const actuals = await IndicatorActual.find({
    project: { $in: projectIds },
    status: "submitted",
  })
    .populate("indicator", "name")
    .populate("period", "name")
    .populate("project", "name")
    .populate("enteredBy", "name email")
    .sort({ submittedAt: 1 });

  res.json({ status: "success", data: { actuals } });
});
