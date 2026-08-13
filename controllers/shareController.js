import ShareLink from "../models/ShareLink.js";
import Project from "../models/Project.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";

export const createShareLink = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const project = await getOrgProject(req.params.projectId, req.orgId);
  const { label, periodId, expiresAt } = req.body;
  const token = ShareLink.createToken();
  const link = await ShareLink.create({
    project: project._id,
    organization: req.orgId,
    token,
    label: label || "Donor view",
    period: periodId || null,
    expiresAt: expiresAt || null,
    createdBy: req.user._id,
  });

  const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/share/${token}`;
  res.status(201).json({ status: "success", data: { link, url } });
});

export const listShareLinks = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const links = await ShareLink.find({
    project: req.params.projectId,
    revokedAt: null,
  }).sort({ createdAt: -1 });
  res.json({ status: "success", data: { links } });
});

export const revokeShareLink = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const link = await ShareLink.findOne({
    _id: req.params.linkId,
    project: req.params.projectId,
  });
  if (!link) throw new AppError("Share link not found", 404);
  link.revokedAt = new Date();
  await link.save();
  res.json({ status: "success", message: "Revoked" });
});

export const publicShareView = catchAsync(async (req, res) => {
  const link = await ShareLink.findOne({
    token: req.params.token,
    revokedAt: null,
  });
  if (!link) throw new AppError("Share link not found", 404);
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    throw new AppError("Share link expired", 410);
  }

  const project = await Project.findById(link.project);
  if (!project) throw new AppError("Project not found", 404);

  // Reuse dashboard logic with a synthetic request
  req.params.projectId = String(project._id);
  req.orgId = link.organization;
  req.user = { role: "viewer", _id: null };
  if (link.period) req.query.periodId = String(link.period);

  // Inline lightweight dashboard (avoid auth org mismatch)
  const { default: Indicator } = await import("../models/Indicator.js");
  const { default: IndicatorTarget } = await import("../models/IndicatorTarget.js");
  const { default: IndicatorActual } = await import("../models/IndicatorActual.js");
  const { default: ReportingPeriod } = await import("../models/ReportingPeriod.js");
  const { computeProgress, getDeadlineCountdown, periodLifecycleStatus, aggregateByIndicator } =
    await import("../utils/progress.js");

  const periods = await ReportingPeriod.find({ project: project._id }).sort({
    startDate: 1,
  });
  let period = link.period
    ? periods.find((p) => String(p._id) === String(link.period))
    : periods.find((p) => p.status !== "locked") || periods[periods.length - 1];

  const indicators = await Indicator.find({
    project: project._id,
    isActive: true,
  }).sort({ sortOrder: 1 });
  const targets = period
    ? await IndicatorTarget.find({ project: project._id, period: period._id })
    : [];
  const actuals = period
    ? await IndicatorActual.find({ project: project._id, period: period._id })
    : [];
  const tMap = Object.fromEntries(targets.map((t) => [String(t.indicator), t]));
  const aMap = aggregateByIndicator(actuals);

  const cards = indicators.map((ind) => {
    const t = tMap[String(ind._id)];
    const a = aMap[String(ind._id)];
    return {
      name: ind.name,
      baseline: ind.baselineValue,
      target: t?.targetValue ?? null,
      actual: a?.value ?? null,
      progress: computeProgress({
        baseline: ind.baselineValue,
        target: t?.targetValue,
        actual: a?.value,
        direction: ind.direction,
      }),
    };
  });

  res.json({
    status: "success",
    data: {
      label: link.label,
      project: { name: project.name, description: project.description, sector: project.sector },
      period: period
        ? {
            name: period.name,
            endDate: period.endDate,
            countdown: getDeadlineCountdown(period.endDate),
            lifecycle: periodLifecycleStatus(period),
          }
        : null,
      cards,
    },
  });
});
