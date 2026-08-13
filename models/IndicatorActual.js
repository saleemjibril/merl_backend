import mongoose from "mongoose";

const indicatorActualSchema = new mongoose.Schema(
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
    value: { type: Number, default: null },
    textValue: { type: String, default: "" },
    narrative: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Multiple entries (contributions) are allowed per indicator+period — each row
// is one contributor's reported value. The compound index is for fast lookups,
// NOT uniqueness.
indicatorActualSchema.index({ indicator: 1, period: 1 });

export default mongoose.model("IndicatorActual", indicatorActualSchema);
