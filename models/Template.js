import mongoose from "mongoose";

/**
 * Sector starter frameworks. `blueprint` shape:
 * {
 *   nodes: [{ tempId, parentTempId, level, title, description, sortOrder }],
 *   indicators: [{ resultNodeTempId, name, description, unit, direction, baselineValue, requiresEvidence }]
 * }
 */
const templateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    sector: {
      type: String,
      enum: ["agriculture", "health", "education", "other"],
      required: true,
    },
    description: { type: String, default: "" },
    blueprint: { type: mongoose.Schema.Types.Mixed, required: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Template", templateSchema);
