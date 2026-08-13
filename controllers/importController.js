import Indicator from "../models/Indicator.js";
import IndicatorTarget from "../models/IndicatorTarget.js";
import IndicatorActual from "../models/IndicatorActual.js";
import ReportingPeriod from "../models/ReportingPeriod.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";

/**
 * CSV import body:
 * {
 *   type: "indicators" | "targets" | "actuals",
 *   periodId?: string,
 *   rows: array of objects
 * }
 *
 * indicators: [{ name, description, unit, direction, baselineValue, requiresEvidence }]
 * targets: [{ indicatorName, targetValue, notes }]
 * actuals: [{ indicatorName, value, narrative }]
 */
export const importCsvRows = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const { type, rows, periodId } = req.body;
  if (!type || !Array.isArray(rows)) {
    throw new AppError("type and rows[] are required", 400);
  }

  const created = [];
  const updated = [];
  const errors = [];

  if (type === "indicators") {
    for (const [i, row] of rows.entries()) {
      try {
        if (!row.name) throw new Error("name required");
        const doc = await Indicator.create({
          project: req.params.projectId,
          name: row.name,
          description: row.description || "",
          unit: row.unit || "number",
          direction: row.direction || "increase",
          baselineValue: Number(row.baselineValue) || 0,
          requiresEvidence: String(row.requiresEvidence).toLowerCase() === "true",
          sortOrder: i,
        });
        created.push(doc);
      } catch (e) {
        errors.push({ row: i + 1, message: e.message });
      }
    }
  } else if (type === "targets" || type === "actuals") {
    if (!periodId) throw new AppError("periodId required for targets/actuals", 400);
    const period = await ReportingPeriod.findOne({
      _id: periodId,
      project: req.params.projectId,
    });
    if (!period) throw new AppError("Period not found", 404);
    if (period.status === "locked") throw new AppError("Period is locked", 400);

    const indicators = await Indicator.find({
      project: req.params.projectId,
      isActive: true,
    });
    const byName = Object.fromEntries(
      indicators.map((ind) => [ind.name.trim().toLowerCase(), ind])
    );

    for (const [i, row] of rows.entries()) {
      try {
        const ind = byName[String(row.indicatorName || "").trim().toLowerCase()];
        if (!ind) throw new Error(`Unknown indicator: ${row.indicatorName}`);

        if (type === "targets") {
          const doc = await IndicatorTarget.findOneAndUpdate(
            { indicator: ind._id, period: periodId },
            {
              indicator: ind._id,
              period: periodId,
              project: req.params.projectId,
              targetValue: Number(row.targetValue),
              notes: row.notes || "",
            },
            { upsert: true, new: true }
          );
          updated.push(doc);
        } else {
          const doc = await IndicatorActual.create({
            indicator: ind._id,
            period: periodId,
            project: req.params.projectId,
            value: row.value === "" || row.value == null ? null : Number(row.value),
            narrative: row.narrative || "",
            enteredBy: req.user._id,
            status: "draft",
          });
          updated.push(doc);
        }
      } catch (e) {
        errors.push({ row: i + 1, message: e.message });
      }
    }
  } else {
    throw new AppError("type must be indicators, targets, or actuals", 400);
  }

  res.json({
    status: "success",
    data: {
      created: created.length,
      updated: updated.length,
      errors,
    },
  });
});
