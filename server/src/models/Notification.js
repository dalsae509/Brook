import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["auction_won", "auction_ended", "outbid", "wishlist_auction_started", "chat_created"],
      required: true,
    },
    message: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productTitle: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
