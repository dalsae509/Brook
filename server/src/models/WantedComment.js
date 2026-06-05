import mongoose from "mongoose";

const wantedCommentSchema = new mongoose.Schema(
  {
    wantedPost: { type: mongoose.Schema.Types.ObjectId, ref: "WantedPost", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

wantedCommentSchema.index({ wantedPost: 1, createdAt: 1 });

export default mongoose.model("WantedComment", wantedCommentSchema);
