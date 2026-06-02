import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

bidSchema.index({ product: 1, amount: -1, createdAt: 1 });
bidSchema.index({ bidder: 1, createdAt: -1 });

const Bid = mongoose.model("Bid", bidSchema);

export default Bid;