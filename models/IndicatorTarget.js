import mongoose from "mongoose";

const indicatorTargetSchema = new mongoose.Schema(
  {
    indicator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Indicator",
      required: true,
      index: true,
    },
    period: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportingPeriod",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    targetValue: { type: Number, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

indicatorTargetSchema.index({ indicator: 1, period: 1 }, { unique: true });

export default mongoose.model("IndicatorTarget", indicatorTargetSchema);
