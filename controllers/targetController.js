import IndicatorTarget from "../models/IndicatorTarget.js";
import Indicator from "../models/Indicator.js";
import ReportingPeriod from "../models/ReportingPeriod.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";

export const listTargets = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const filter = { project: req.params.projectId };
  if (req.query.periodId) filter.period = req.query.periodId;
  const targets = await IndicatorTarget.find(filter)
    .populate("indicator", "name unit direction baselineValue")
    .populate("period", "name startDate endDate");
  res.json({ status: "success", data: { targets } });
});

/** Upsert a grid of targets: [{ indicatorId, periodId, targetValue, notes }] */
export const upsertTargets = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const { targets } = req.body;
  if (!Array.isArray(targets)) throw new AppError("targets array required", 400);

  const results = [];
  for (const row of targets) {
    if (!row.indicatorId || !row.periodId || row.targetValue === undefined) {
      continue;
    }
    const ind = await Indicator.findOne({
      _id: row.indicatorId,
      project: req.params.projectId,
    });
    const period = await ReportingPeriod.findOne({
      _id: row.periodId,
      project: req.params.projectId,
    });
    if (!ind || !period) continue;
    if (period.status === "locked") continue;

    const doc = await IndicatorTarget.findOneAndUpdate(
      { indicator: row.indicatorId, period: row.periodId },
      {
        indicator: row.indicatorId,
        period: row.periodId,
        project: req.params.projectId,
        targetValue: Number(row.targetValue),
        notes: row.notes || "",
      },
      { upsert: true, new: true }
    );
    results.push(doc);
  }

  res.json({ status: "success", data: { targets: results } });
});
