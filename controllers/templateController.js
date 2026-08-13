import Template from "../models/Template.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";
import { applyBlueprintToProject } from "../utils/applyBlueprint.js";

export const listTemplates = catchAsync(async (req, res) => {
  const filter = { isPublished: true };
  if (req.query.sector) filter.sector = req.query.sector;
  const templates = await Template.find(filter).sort({ sector: 1, name: 1 });
  res.json({ status: "success", data: { templates } });
});

export const getTemplate = catchAsync(async (req, res) => {
  const template = await Template.findOne({
    key: req.params.key,
    isPublished: true,
  });
  if (!template) throw new AppError("Template not found", 404);
  res.json({ status: "success", data: { template } });
});

export const applyTemplateToProject = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const project = await getOrgProject(req.params.projectId, req.orgId);
  const { templateKey } = req.body;
  const template = await Template.findOne({ key: templateKey, isPublished: true });
  if (!template) throw new AppError("Template not found", 404);

  const result = await applyBlueprintToProject(
    project,
    template.blueprint,
    template.name
  );
  project.templateKey = template.key;
  project.sector = template.sector;
  await project.save();

  res.json({
    status: "success",
    data: {
      framework: result.framework,
      nodeCount: result.nodes.length,
      indicatorCount: result.indicators.length,
    },
  });
});
