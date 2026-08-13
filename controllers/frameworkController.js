import ResultNode from "../models/ResultNode.js";
import Indicator from "../models/Indicator.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";
import { ensureFramework } from "../utils/applyBlueprint.js";

function buildTree(nodes) {
  const byId = {};
  const roots = [];
  for (const n of nodes) {
    byId[String(n._id)] = { ...n.toObject(), children: [], indicators: [] };
  }
  for (const n of nodes) {
    const node = byId[String(n._id)];
    if (n.parent && byId[String(n.parent)]) {
      byId[String(n.parent)].children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    list.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

export const getFrameworkTree = catchAsync(async (req, res) => {
  const project = await getOrgProject(req.params.projectId, req.orgId);
  const framework = await ensureFramework(project._id);
  const nodes = await ResultNode.find({ project: project._id }).sort({
    sortOrder: 1,
  });
  const indicators = await Indicator.find({
    project: project._id,
    isActive: true,
  }).sort({ sortOrder: 1 });

  const tree = buildTree(nodes);
  const attachIndicators = (list) => {
    for (const node of list) {
      node.indicators = indicators
        .filter((i) => i.resultNode && String(i.resultNode) === String(node._id))
        .map((i) => i.toObject());
      attachIndicators(node.children);
    }
  };
  attachIndicators(tree);

  const unassignedIndicators = indicators
    .filter((i) => !i.resultNode)
    .map((i) => i.toObject());

  res.json({
    status: "success",
    data: { framework, tree, unassignedIndicators, flatNodes: nodes },
  });
});

export const createNode = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  const project = await getOrgProject(req.params.projectId, req.orgId);
  const framework = await ensureFramework(project._id);
  const { title, description, level, parent, sortOrder } = req.body;
  if (!title || !level) throw new AppError("title and level are required", 400);
  if (!ResultNode.LEVELS.includes(level)) {
    throw new AppError(`level must be one of ${ResultNode.LEVELS.join(", ")}`, 400);
  }

  if (parent) {
    const parentNode = await ResultNode.findOne({
      _id: parent,
      project: project._id,
    });
    if (!parentNode) throw new AppError("Parent node not found", 404);
  }

  const node = await ResultNode.create({
    framework: framework._id,
    project: project._id,
    parent: parent || null,
    level,
    title,
    description: description || "",
    sortOrder: sortOrder ?? 0,
  });

  res.status(201).json({ status: "success", data: { node } });
});

export const updateNode = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const node = await ResultNode.findOne({
    _id: req.params.nodeId,
    project: req.params.projectId,
  });
  if (!node) throw new AppError("Node not found", 404);

  const fields = ["title", "description", "level", "parent", "sortOrder"];
  for (const f of fields) {
    if (req.body[f] !== undefined) node[f] = req.body[f];
  }
  await node.save();
  res.json({ status: "success", data: { node } });
});

export const deleteNode = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const node = await ResultNode.findOne({
    _id: req.params.nodeId,
    project: req.params.projectId,
  });
  if (!node) throw new AppError("Node not found", 404);

  const childCount = await ResultNode.countDocuments({ parent: node._id });
  if (childCount > 0) {
    throw new AppError("Remove child nodes first", 400);
  }

  await Indicator.updateMany(
    { resultNode: node._id },
    { $set: { resultNode: null } }
  );
  await node.deleteOne();
  res.json({ status: "success", message: "Node deleted" });
});

export const reorderNodes = catchAsync(async (req, res) => {
  assertRole(req.user, "coordinator");
  await getOrgProject(req.params.projectId, req.orgId);
  const { items } = req.body; // [{ id, sortOrder, parent }]
  if (!Array.isArray(items)) throw new AppError("items array required", 400);

  await Promise.all(
    items.map((item) =>
      ResultNode.findOneAndUpdate(
        { _id: item.id, project: req.params.projectId },
        {
          sortOrder: item.sortOrder ?? 0,
          ...(item.parent !== undefined ? { parent: item.parent || null } : {}),
        }
      )
    )
  );

  res.json({ status: "success", message: "Reordered" });
});
