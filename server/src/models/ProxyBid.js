import mongoose from "mongoose";

// 자동 입찰(대리 입찰) 설정 — 입찰자가 지정한 최대 입찰가
const proxyBidSchema = new mongoose.Schema(
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
    maxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// 상품당 입찰자별 1개 (재설정 시 갱신)
proxyBidSchema.index({ product: 1, bidder: 1 }, { unique: true });

const ProxyBid = mongoose.model("ProxyBid", proxyBidSchema);

export default ProxyBid;
