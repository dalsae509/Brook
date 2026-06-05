import mongoose from "mongoose";
import Product from "../models/Product.js";
import Bid from "../models/Bid.js";
import {
  finalizeAuction,
  triggerAuctionStart,
  scheduleAuctionStart,
  clearAuctionStartTimer,
  getAuctionRoom,
} from "../utils/auctionScheduler.js";
import { getBidUnit } from "../utils/bidUnit.js";
import { createNotification } from "../utils/notificationService.js";

export const startAuction = async (req, res) => {
  try {
    const { productId } = req.params;
    const { durationMinutes } = req.body;

    const numericDuration = Number(durationMinutes);
    if (Number.isNaN(numericDuration) || numericDuration <= 0) {
      return res.status(400).json({ message: "경매 시간은 1분 이상의 숫자로 입력해주세요." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    if (product.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "본인이 등록한 상품만 경매 시작할 수 있습니다." });
    if (product.auctionStatus !== "pending")
      return res.status(400).json({ message: "이미 시작되었거나 종료된 상품입니다." });

    const io = req.app.get("io");
    await triggerAuctionStart(productId, numericDuration, io);

    const updated = await Product.findById(productId);
    return res.status(200).json({ message: "경매 시작 성공", product: updated });
  } catch (error) {
    console.error("startAuction error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const scheduleAuction = async (req, res) => {
  try {
    const { productId } = req.params;
    const { scheduledStartTime, durationMinutes } = req.body;

    const numericDuration = Number(durationMinutes);
    if (Number.isNaN(numericDuration) || numericDuration <= 0) {
      return res.status(400).json({ message: "경매 시간은 1분 이상의 숫자로 입력해주세요." });
    }

    const startTime = new Date(scheduledStartTime);
    if (isNaN(startTime.getTime()) || startTime <= new Date()) {
      return res.status(400).json({ message: "예약 시간은 현재 시간 이후여야 합니다." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    if (product.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "본인이 등록한 상품만 예약할 수 있습니다." });
    if (product.auctionStatus !== "pending")
      return res.status(400).json({ message: "대기 중인 상품만 예약할 수 있습니다." });

    product.scheduledStartTime = startTime;
    product.scheduledDurationMinutes = numericDuration;
    await product.save();

    const io = req.app.get("io");
    scheduleAuctionStart(productId, startTime, numericDuration, io);

    return res.status(200).json({ message: "경매 예약 성공", product });
  } catch (error) {
    console.error("scheduleAuction error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const cancelAuctionSchedule = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    if (product.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "본인이 등록한 상품만 수정할 수 있습니다." });
    if (!product.scheduledStartTime)
      return res.status(400).json({ message: "예약된 경매가 없습니다." });

    clearAuctionStartTimer(productId);
    product.scheduledStartTime = null;
    product.scheduledDurationMinutes = null;
    await product.save();

    return res.status(200).json({ message: "경매 예약 취소 성공", product });
  } catch (error) {
    console.error("cancelAuctionSchedule error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const placeBid = async (req, res) => {
  try {
    const { productId } = req.params;
    const { amount } = req.body;

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "입찰 금액은 0보다 큰 숫자여야 합니다.",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "본인 상품에는 입찰할 수 없습니다." });
    }

    if (product.auctionStatus !== "live") {
      return res.status(400).json({ message: "진행 중인 경매가 아닙니다." });
    }

    if (product.endTime && new Date(product.endTime).getTime() <= Date.now()) {
      const io = req.app.get("io");
      await finalizeAuction(product._id, io, "system");
      return res.status(400).json({ message: "이미 종료된 경매입니다." });
    }

    const highestBid = await Bid.findOne({ product: productId }).sort({ amount: -1, createdAt: 1 });
    if (highestBid?.bidder.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "현재 최고 입찰자입니다. 다른 입찰자가 등장한 뒤에 입찰할 수 있습니다." });
    }

    const bidUnit = getBidUnit(product.currentPrice, product.bidTiers);

    if (numericAmount < product.currentPrice + bidUnit) {
      return res.status(400).json({
        message: `입찰 단위는 ${bidUnit.toLocaleString()}원입니다. 최소 ${(product.currentPrice + bidUnit).toLocaleString()}원 이상 입찰해야 합니다.`,
      });
    }

    const session = await mongoose.startSession();
    let updatedProduct, populatedBid, isConflict = false;

    try {
      await session.withTransaction(async () => {
        isConflict = false;
        updatedProduct = await Product.findOneAndUpdate(
          {
            _id: productId,
            auctionStatus: "live",
            currentPrice: { $lte: numericAmount - bidUnit },
          },
          { $set: { currentPrice: numericAmount } },
          { new: true, session }
        );

        if (!updatedProduct) {
          isConflict = true;
          throw new Error("CONFLICT");
        }

        const [bid] = await Bid.create(
          [{ product: updatedProduct._id, bidder: req.user._id, amount: numericAmount }],
          { session }
        );

        populatedBid = await Bid.findById(bid._id).populate("bidder", "name").session(session);
      });
    } catch (err) {
      if (!isConflict) throw err;
    } finally {
      await session.endSession();
    }

    if (isConflict) {
      return res.status(409).json({
        message: "다른 입찰이 먼저 처리되었습니다. 현재가를 확인하고 다시 입찰해주세요.",
      });
    }

    const io = req.app.get("io");

    if (highestBid) {
      await createNotification(io, highestBid.bidder, {
        type: "outbid",
        message: `"${product.title}" 경매에서 더 높은 입찰이 들어왔습니다. 재입찰해보세요!`,
        productId: product._id,
        productTitle: product.title,
      });
    }

    io.to(getAuctionRoom(updatedProduct._id)).emit("auction:bid", {
      productId: String(updatedProduct._id),
      currentPrice: updatedProduct.currentPrice,
      bid: {
        id: String(populatedBid._id),
        bidder: populatedBid.bidder,
        amount: populatedBid.amount,
        createdAt: populatedBid.createdAt,
      },
      endTime: updatedProduct.endTime,
    });

    return res.status(201).json({
      message: "입찰 성공",
      bid: populatedBid,
      currentPrice: updatedProduct.currentPrice,
    });
  } catch (error) {
    console.error("placeBid error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getBids = async (req, res) => {
  try {
    const { productId } = req.params;

    const bids = await Bid.find({ product: productId })
      .populate("bidder", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ message: "입찰 목록 조회 성공", bids });
  } catch (error) {
    console.error("getBids error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const endAuction = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    if (product.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "본인이 등록한 상품만 경매 종료할 수 있습니다." });
    if (product.auctionStatus !== "live")
      return res.status(400).json({ message: "진행 중인 경매만 종료할 수 있습니다." });

    const io = req.app.get("io");
    const result = await finalizeAuction(product._id, io, "seller");

    return res.status(200).json({
      message: "경매 종료 성공",
      product: result?.product ?? null,
      result: result?.payload ?? null,
    });
  } catch (error) {
    console.error("endAuction error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};
