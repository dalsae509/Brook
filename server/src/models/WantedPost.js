import mongoose from "mongoose";

const wantedPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    targetPrice: { type: Number, default: null, min: 0 },
    status: { type: String, enum: ["open", "closed"], default: "open" },
  },
  { timestamps: true }
);

wantedPostSchema.index({ status: 1, createdAt: -1 });
wantedPostSchema.index({ author: 1, createdAt: -1 });

export default mongoose.model("WantedPost", wantedPostSchema);
