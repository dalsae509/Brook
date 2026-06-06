import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "상품명은 필수입니다."],
      trim: true,
      maxlength: [100, "상품명은 100자 이하여야 합니다."],
    },
    description: {
      type: String,
      required: [true, "상품 설명은 필수입니다."],
      trim: true,
      maxlength: [2000, "상품 설명은 2000자 이하여야 합니다."],
    },
    category: {
      type: String,
      required: [true, "카테고리는 필수입니다."],
      trim: true,
      maxlength: [50, "카테고리는 50자 이하여야 합니다."],
    },
    images: {
      type: [String],
      default: [],
    },
    saleType: {
      type: String,
      enum: ["fixed", "auction"],
      required: true,
      default: "auction",
    },
    fixedPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    fixedStatus: {
      type: String,
      enum: ["available", "reserved", "sold"],
      default: "available",
    },
    onFailedAuction: {
      type: String,
      enum: ["convert", "close"],
      default: "close",
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    startPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    currentPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    auctionStatus: {
      type: String,
      enum: ["pending", "live", "ended"],
      default: "pending",
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bidTiers: {
      type: [
        {
          upTo: { type: Number, default: null },
          unit: { type: Number, required: true, min: 1 },
          _id: false,
        },
      ],
      default: [],
    },
    auctionTradeConfirmed: {
      type: Boolean,
      default: false,
    },
    reservedAt: {
      type: Date,
      default: null,
    },
    tradeReminderSentAt: {
      type: Date,
      default: null,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    scheduledStartTime: {
      type: Date,
      default: null,
    },
    scheduledDurationMinutes: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ seller: 1, createdAt: -1 });
productSchema.index({ winner: 1, auctionStatus: 1 });
productSchema.index({ saleType: 1, auctionStatus: 1, createdAt: -1 });
productSchema.index({ saleType: 1, fixedStatus: 1, createdAt: -1 });
productSchema.index({ auctionStatus: 1, endTime: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;