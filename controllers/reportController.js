import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import ReportExport from "../models/ReportExport.js";
import Indicator from "../models/Indicator.js";
import IndicatorTarget from "../models/IndicatorTarget.js";
import IndicatorActual from "../models/IndicatorActual.js";
import ReportingPeriod from "../models/ReportingPeriod.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";
import { computeProgress, aggregateByIndicator } from "../utils/progress.js";

const reportDir = path.join(process.env.UPLOAD_DIR || "uploads/evidence", "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

async function gatherRows(projectId, periodId) {
  const indicators = await Indicator.find({ project: projectId, isActive: true }).sort({
    sortOrder: 1,
  });
  const targets = await IndicatorTarget.find({ project: projectId, period: periodId });
  const actuals = await IndicatorActual.find({ project: projectId, period: periodId });
  const tMap = Object.fromEntries(targets.map((t) => [String(t.indicator), t]));
  const aMap = aggregateByIndicator(actuals);

  return indicators.map((ind) => {
    const t = tMap[String(ind._id)];
    const a = aMap[String(ind._id)];
    const progress = computeProgress({
      baseline: ind.baselineValue,
      target: t?.targetValue,
      actual: a?.value,
      direction: ind.direction,
    });
    return {
      name: ind.name,
      baseline: ind.baselineValue,
      target: t?.targetValue ?? "",
      actual: a?.value ?? "",
      percent: progress.percent ?? "",
      status: progress.status,
      narrative: a?.narrative || "",
      workflow: a?.status || "missing",
    };
  });
}

export const generateReport = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  const project = await getOrgProject(req.params.projectId, req.orgId);
  const { periodId, format = "pdf" } = req.body;
  if (!periodId) throw new AppError("periodId is required", 400);
  if (!["pdf", "xlsx", "csv"].includes(format)) {
    throw new AppError("format must be pdf, xlsx, or csv", 400);
  }

  const period = await ReportingPeriod.findOne({
    _id: periodId,
    project: project._id,
  });
  if (!period) throw new AppError("Period not found", 404);

  const rows = await gatherRows(project._id, periodId);
  const storedName = `${uuidv4()}.${format === "xlsx" ? "xlsx" : format}`;
  const filePath = path.join(reportDir, storedName);
  let fileName = `${project.name.replace(/[^\w.-]+/g, "_")}_${period.name.replace(/[^\w.-]+/g, "_")}.${format === "xlsx" ? "xlsx" : format}`;

  if (format === "pdf") {
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(18).text("MERL Progress Report", { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Project: ${project.name}`);
      doc.text(`Period: ${period.name}`);
      doc.text(
        `Dates: ${new Date(period.startDate).toLocaleDateString()} – ${new Date(period.endDate).toLocaleDateString()}`
      );
      doc.moveDown();
      rows.forEach((r, i) => {
        doc
          .fontSize(11)
          .text(
            `${i + 1}. ${r.name} — baseline ${r.baseline} / target ${r.target} / actual ${r.actual} (${r.percent || "—"}% · ${r.status})`
          );
        if (r.narrative) {
          doc.fontSize(9).fillColor("#444").text(`   ${r.narrative}`);
          doc.fillColor("#000");
        }
        doc.moveDown(0.4);
      });
      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  } else if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = [
      { header: "Indicator", key: "name", width: 40 },
      { header: "Baseline", key: "baseline", width: 12 },
      { header: "Target", key: "target", width: 12 },
      { header: "Actual", key: "actual", width: 12 },
      { header: "%", key: "percent", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Workflow", key: "workflow", width: 12 },
      { header: "Narrative", key: "narrative", width: 50 },
    ];
    rows.forEach((r) => sheet.addRow(r));
    await workbook.xlsx.writeFile(filePath);
  } else {
    const header = "Indicator,Baseline,Target,Actual,Percent,Status,Workflow,Narrative\n";
    const body = rows
      .map((r) =>
        [r.name, r.baseline, r.target, r.actual, r.percent, r.status, r.workflow, `"${(r.narrative || "").replace(/"/g, '""')}"`]
          .join(",")
      )
      .join("\n");
    fs.writeFileSync(filePath, header + body);
  }

  const record = await ReportExport.create({
    project: project._id,
    periods: [periodId],
    format,
    fileName,
    storedName,
    generatedBy: req.user._id,
  });

  res.status(201).json({ status: "success", data: { report: record } });
});

export const listReports = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const reports = await ReportExport.find({ project: req.params.projectId })
    .sort({ createdAt: -1 })
    .populate("generatedBy", "name");
  res.json({ status: "success", data: { reports } });
});

export const downloadReport = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const report = await ReportExport.findOne({
    _id: req.params.reportId,
    project: req.params.projectId,
  });
  if (!report) throw new AppError("Report not found", 404);
  const filePath = path.join(reportDir, report.storedName);
  if (!fs.existsSync(filePath)) throw new AppError("File missing", 404);
  res.download(filePath, report.fileName);
});
