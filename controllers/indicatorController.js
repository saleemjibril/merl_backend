import Indicator from "../models/Indicator.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";

export const listIndicators = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const filter = { project: req.params.projectId };
  if (req.query.active !== "false") filter.isActive = true;
  if (req.query.resultNode) filter.resultNode = req.query.resultNode;
  const indicators = await Indicator.find(filter)
    .populate("resultNode", "title level")
    .sort({ sortOrder: 1, createdAt: 1 });
  res.json({ status: "success", data: { indicators } });
});

export const createIndicator = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const {
    name,
    description,
    unit,
    direction,
    baselineValue,
    baselineDate,
    aggregation,
    requiresEvidence,
    resultNode,
    sortOrder,
  } = req.body;
  if (!name) throw new AppError("name is required", 400);

  const indicator = await Indicator.create({
    project: req.params.projectId,
    name,
    description,
    unit: unit || "number",
    direction: direction || "increase",
    baselineValue: baselineValue ?? 0,
    baselineDate,
    aggregation: aggregation || "latest",
    requiresEvidence: !!requiresEvidence,
    resultNode: resultNode || null,
    sortOrder: sortOrder ?? 0,
  });

  res.status(201).json({ status: "success", data: { indicator } });
});

export const updateIndicator = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const indicator = await Indicator.findOne({
    _id: req.params.indicatorId,
    project: req.params.projectId,
  });
  if (!indicator) throw new AppError("Indicator not found", 404);

  const fields = [
    "name",
    "description",
    "unit",
    "direction",
    "baselineValue",
    "baselineDate",
    "aggregation",
    "requiresEvidence",
    "resultNode",
    "sortOrder",
    "isActive",
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) indicator[f] = req.body[f];
  }
  await indicator.save();
  res.json({ status: "success", data: { indicator } });
});

export const deleteIndicator = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const indicator = await Indicator.findOne({
    _id: req.params.indicatorId,
    project: req.params.projectId,
  });
  if (!indicator) throw new AppError("Indicator not found", 404);
  indicator.isActive = false;
  await indicator.save();
  res.json({ status: "success", message: "Indicator archived" });
});
