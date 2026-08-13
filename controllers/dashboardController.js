import Indicator from "../models/Indicator.js";
import IndicatorTarget from "../models/IndicatorTarget.js";
import IndicatorActual from "../models/IndicatorActual.js";
import ReportingPeriod from "../models/ReportingPeriod.js";
import ResultNode from "../models/ResultNode.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { getOrgProject } from "../utils/access.js";
import {
  computeProgress,
  getDeadlineCountdown,
  periodLifecycleStatus,
  aggregateByIndicator,
} from "../utils/progress.js";

export const projectDashboard = catchAsync(async (req, res) => {
  const project = await getOrgProject(req.params.projectId, req.orgId);
  let periodId = req.query.periodId;
  const periods = await ReportingPeriod.find({ project: project._id }).sort({
    startDate: 1,
  });

  let period = null;
  if (periodId) {
    period = periods.find((p) => String(p._id) === String(periodId));
  } else {
    const now = new Date();
    period =
      periods.find(
        (p) =>
          p.status !== "locked" &&
          new Date(p.startDate) <= now &&
          new Date(p.endDate) >= now
      ) || periods[periods.length - 1] || null;
  }

  const indicators = await Indicator.find({
    project: project._id,
    isActive: true,
  })
    .populate("resultNode", "title level")
    .sort({ sortOrder: 1 });

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
    const progress = computeProgress({
      baseline: ind.baselineValue,
      target: t?.targetValue,
      actual: a?.value,
      direction: ind.direction,
    });
    return {
      indicatorId: ind._id,
      name: ind.name,
      description: ind.description,
      unit: ind.unit,
      resultNode: ind.resultNode,
      baseline: ind.baselineValue,
      target: t?.targetValue ?? null,
      actual: a?.value ?? null,
      actualStatus: a?.status || null,
      narrative: a?.narrative || "",
      progress,
    };
  });

  const counts = {
    total: cards.length,
    achieved: cards.filter((c) => c.progress.status === "achieved").length,
    onTrack: cards.filter((c) => c.progress.status === "on_track").length,
    atRisk: cards.filter((c) => c.progress.status === "at_risk").length,
    offTrack: cards.filter((c) => c.progress.status === "off_track").length,
    missing: cards.filter((c) => c.progress.status === "missing").length,
    submitted: actuals.filter((a) => a.status === "submitted").length,
    approved: actuals.filter((a) => a.status === "approved").length,
  };

  const nodeCount = await ResultNode.countDocuments({ project: project._id });

  res.json({
    status: "success",
    data: {
      project,
      period: period
        ? {
            ...period.toObject(),
            lifecycle: periodLifecycleStatus(period),
            countdown: getDeadlineCountdown(period.endDate),
          }
        : null,
      periods: periods.map((p) => ({
        ...p.toObject(),
        lifecycle: periodLifecycleStatus(p),
        countdown: getDeadlineCountdown(p.endDate),
      })),
      counts,
      cards,
      meta: { nodeCount, indicatorCount: indicators.length },
    },
  });
});

export const portfolioDashboard = catchAsync(async (req, res) => {
  // Reuse listProjects enrichment via redirect-style call
  const { listProjects } = await import("./projectController.js");
  return listProjects(req, res);
});
