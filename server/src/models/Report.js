import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: {
      type: String,
      enum: ["사기 의심", "허위 상품", "욕설·비방", "기타"],
      required: true,
    },
    description: { type: String, default: "", maxlength: 500 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

reportSchema.index({ reportedUser: 1, status: 1 });
reportSchema.index({ reporter: 1, createdAt: -1 });

export default mongoose.model("Report", reportSchema);
