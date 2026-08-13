import Project from "../models/Project.js";
import Framework from "../models/Framework.js";
import Template from "../models/Template.js";
import ReportingPeriod from "../models/ReportingPeriod.js";
import Indicator from "../models/Indicator.js";
import IndicatorActual from "../models/IndicatorActual.js";
import IndicatorTarget from "../models/IndicatorTarget.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";
import { applyBlueprintToProject, ensureFramework } from "../utils/applyBlueprint.js";
import { computeProgress, getDeadlineCountdown } from "../utils/progress.js";
import { logAudit } from "../utils/audit.js";

export const listProjects = catchAsync(async (req, res) => {
  const filter = { organization: req.orgId };
  if (req.query.status) filter.status = req.query.status;
  else filter.status = { $ne: "archived" };

  const projects = await Project.find(filter).sort({ updatedAt: -1 });

  const enriched = await Promise.all(
    projects.map(async (p) => {
      const periods = await ReportingPeriod.find({ project: p._id });
      const now = new Date();
      const current =
        periods.find(
          (per) =>
            per.status !== "locked" &&
            new Date(per.startDate) <= now &&
            new Date(per.endDate) >= now
        ) || periods.sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];

      let summary = {
        indicatorCount: await Indicator.countDocuments({
          project: p._id,
          isActive: true,
        }),
        periodName: current?.name || null,
        periodEnd: current?.endDate || p.endDate || null,
        countdown: getDeadlineCountdown(current?.endDate || p.endDate),
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
        missing: 0,
      };

      if (current) {
        const indicators = await Indicator.find({ project: p._id, isActive: true });
        const targets = await IndicatorTarget.find({
          project: p._id,
          period: current._id,
        });
        const actuals = await IndicatorActual.find({
          project: p._id,
          period: current._id,
        });
        const tMap = Object.fromEntries(targets.map((t) => [String(t.indicator), t]));
        const aMap = Object.fromEntries(actuals.map((a) => [String(a.indicator), a]));

        for (const ind of indicators) {
          const t = tMap[String(ind._id)];
          const a = aMap[String(ind._id)];
          const { status } = computeProgress({
            baseline: ind.baselineValue,
            target: t?.targetValue,
            actual: a?.value,
            direction: ind.direction,
          });
          if (status === "missing") summary.missing += 1;
          else if (status === "off_track") summary.offTrack += 1;
          else if (status === "at_risk") summary.atRisk += 1;
          else summary.onTrack += 1;
        }
      }

      return { ...p.toObject(), summary };
    })
  );

  res.json({ status: "success", data: { projects: enriched } });
});

export const createProject = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");

  const {
    name,
    description,
    sector,
    location,
    state,
    lga,
    startDate,
    endDate,
    templateKey,
  } = req.body;
  if (!name) throw new AppError("Project name is required", 400);

  const stateVal = state || "";
  const lgaVal = lga || "";
  const locationVal =
    location || [lgaVal, stateVal].filter(Boolean).join(", ");

  const project = await Project.create({
    organization: req.orgId,
    name,
    description,
    sector: sector || "other",
    location: locationVal,
    state: stateVal,
    lga: lgaVal,
    startDate,
    endDate,
    createdBy: req.user._id,
    templateKey: templateKey || null,
  });

  await ensureFramework(project._id);

  if (templateKey) {
    const template = await Template.findOne({ key: templateKey, isPublished: true });
    if (template) {
      await applyBlueprintToProject(project, template.blueprint, template.name);
    }
  }

  await logAudit({
    organization: req.orgId,
    project: project._id,
    actor: req.user._id,
    action: "project.created",
    entityType: "Project",
    entityId: project._id,
  });

  res.status(201).json({ status: "success", data: { project } });
});

export const getProject = catchAsync(async (req, res) => {
  const project = await getOrgProject(req.params.id, req.orgId);
  const framework = await Framework.findOne({ project: project._id });
  res.json({ status: "success", data: { project, framework } });
});

export const updateProject = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const project = await getOrgProject(req.params.id, req.orgId);
  const fields = [
    "name",
    "description",
    "sector",
    "location",
    "state",
    "lga",
    "startDate",
    "endDate",
    "status",
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) project[f] = req.body[f];
  }
  if (req.body.state !== undefined || req.body.lga !== undefined) {
    project.location = [project.lga, project.state].filter(Boolean).join(", ");
  }
  await project.save();
  res.json({ status: "success", data: { project } });
});

export const deleteProject = catchAsync(async (req, res) => {
  assertRole(req.user, "owner");
  const project = await getOrgProject(req.params.id, req.orgId);
  project.status = "archived";
  await project.save();
  res.json({ status: "success", message: "Project archived" });
});
