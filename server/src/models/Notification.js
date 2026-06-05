import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "auction_won", "auction_ended", "outbid", "wishlist_auction_started",
        "chat_created", "wanted_comment", "wanted_chat_started",
      ],
      required: true,
    },
    message: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productTitle: { type: String },
    wantedPost: { type: mongoose.Schema.Types.ObjectId, ref: "WantedPost" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
