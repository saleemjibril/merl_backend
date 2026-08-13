import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    indicator: { type: mongoose.Schema.Types.ObjectId, ref: "Indicator" },
    period: { type: mongoose.Schema.Types.ObjectId, ref: "ReportingPeriod" },
    message: { type: String, required: true },
    dueAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Reminder", reminderSchema);
