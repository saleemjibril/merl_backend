import mongoose from "mongoose";

const reportingPeriodSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["upcoming", "open", "locked"],
      default: "open",
    },
  },
  { timestamps: true }
);

export default mongoose.model("ReportingPeriod", reportingPeriodSchema);
