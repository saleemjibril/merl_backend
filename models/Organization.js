import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    plan: {
      type: String,
      enum: ["solo", "team", "org", "trial"],
      default: "trial",
    },
    planLimits: {
      maxProjects: { type: Number, default: null },
      maxUsers: { type: Number, default: null },
    },
    billingCustomerId: { type: String, default: null },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 86400000) },
  },
  { timestamps: true }
);

export default mongoose.model("Organization", organizationSchema);
