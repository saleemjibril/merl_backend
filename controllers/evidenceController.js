import path from "path";
import fs from "fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import Evidence from "../models/Evidence.js";
import IndicatorActual from "../models/IndicatorActual.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { assertRole, getOrgProject } from "../utils/access.js";

const uploadDir =
  process.env.UPLOAD_DIR ||
  (process.env.VERCEL ? "/tmp/uploads/evidence" : "uploads/evidence");

function ensureUploadDir() {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureUploadDir();
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const listEvidence = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const filter = { project: req.params.projectId };
  if (req.query.actualId) filter.indicatorActual = req.query.actualId;
  const items = await Evidence.find(filter).sort({ createdAt: -1 });
  res.json({ status: "success", data: { evidence: items } });
});

export const uploadEvidence = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  await getOrgProject(req.params.projectId, req.orgId);
  const { actualId, caption } = req.body;
  if (!actualId) throw new AppError("actualId is required", 400);
  if (!req.file) throw new AppError("file is required", 400);

  const actual = await IndicatorActual.findOne({
    _id: actualId,
    project: req.params.projectId,
  });
  if (!actual) throw new AppError("Actual not found", 404);

  const evidence = await Evidence.create({
    indicatorActual: actualId,
    project: req.params.projectId,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    caption: caption || "",
    uploadedBy: req.user._id,
  });

  res.status(201).json({ status: "success", data: { evidence } });
});

export const deleteEvidence = catchAsync(async (req, res) => {
  assertRole(req.user, "contributor");
  await getOrgProject(req.params.projectId, req.orgId);
  const evidence = await Evidence.findOne({
    _id: req.params.evidenceId,
    project: req.params.projectId,
  });
  if (!evidence) throw new AppError("Evidence not found", 404);

  const filePath = path.join(uploadDir, evidence.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await evidence.deleteOne();
  res.json({ status: "success", message: "Evidence deleted" });
});

export const downloadEvidence = catchAsync(async (req, res) => {
  await getOrgProject(req.params.projectId, req.orgId);
  const evidence = await Evidence.findOne({
    _id: req.params.evidenceId,
    project: req.params.projectId,
  });
  if (!evidence) throw new AppError("Evidence not found", 404);
  const filePath = path.join(uploadDir, evidence.storedName);
  if (!fs.existsSync(filePath)) throw new AppError("File missing on disk", 404);
  res.download(filePath, evidence.fileName);
});
