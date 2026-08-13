import Framework from "../models/Framework.js";
import ResultNode from "../models/ResultNode.js";
import Indicator from "../models/Indicator.js";

/**
 * Apply a template blueprint (nodes + indicators) to a project.
 * Returns { framework, nodes, indicators }.
 */
export async function applyBlueprintToProject(project, blueprint, frameworkName) {
  const framework = await Framework.findOneAndUpdate(
    { project: project._id },
    {
      project: project._id,
      name: frameworkName || "Results framework",
      type: "logframe",
      version: 1,
    },
    { upsert: true, new: true }
  );

  await Indicator.deleteMany({ project: project._id });
  await ResultNode.deleteMany({ project: project._id });

  const tempToId = {};
  const nodes = [...(blueprint.nodes || [])].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );

  // Create parents before children by iterating until resolved
  const pending = [...nodes];
  let guard = 0;
  while (pending.length && guard < 50) {
    guard += 1;
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const n = pending[i];
      if (n.parentTempId && !tempToId[n.parentTempId]) continue;
      const created = await ResultNode.create({
        framework: framework._id,
        project: project._id,
        parent: n.parentTempId ? tempToId[n.parentTempId] : null,
        level: n.level,
        title: n.title,
        description: n.description || "",
        sortOrder: n.sortOrder ?? 0,
      });
      tempToId[n.tempId] = created._id;
      pending.splice(i, 1);
    }
  }

  const indicators = [];
  for (const [idx, ind] of (blueprint.indicators || []).entries()) {
    const created = await Indicator.create({
      project: project._id,
      resultNode: ind.resultNodeTempId ? tempToId[ind.resultNodeTempId] : null,
      name: ind.name,
      description: ind.description || "",
      unit: ind.unit || "number",
      direction: ind.direction || "increase",
      baselineValue: ind.baselineValue ?? 0,
      requiresEvidence: !!ind.requiresEvidence,
      sortOrder: ind.sortOrder ?? idx,
    });
    indicators.push(created);
  }

  const createdNodes = await ResultNode.find({ project: project._id }).sort({
    sortOrder: 1,
  });

  return { framework, nodes: createdNodes, indicators };
}

export async function ensureFramework(projectId) {
  let framework = await Framework.findOne({ project: projectId });
  if (!framework) {
    framework = await Framework.create({
      project: projectId,
      name: "Results framework",
      type: "logframe",
    });
  }
  return framework;
}
