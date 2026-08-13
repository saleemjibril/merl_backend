import mongoose from "mongoose";

const reportExportSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    periods: [{ type: mongoose.Schema.Types.ObjectId, ref: "ReportingPeriod" }],
    format: {
      type: String,
      enum: ["pdf", "xlsx", "csv"],
      default: "pdf",
    },
    fileName: { type: String, required: true },
    storedName: { type: String, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("ReportExport", reportExportSchema);
