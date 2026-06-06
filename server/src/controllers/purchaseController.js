import mongoose from "mongoose";
import Product from "../models/Product.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { createNotification } from "../utils/notificationService.js";
import { recalculateBrookScore } from "../utils/brookScoreUtil.js";

export const purchaseProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Product.findById(id);

    if (!existing) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    if (existing.seller.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "본인 상품은 구매할 수 없습니다." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let product, chat;
    try {
      product = await Product.findOneAndUpdate(
        { _id: id, saleType: "fixed", fixedStatus: "available" },
        { $set: { fixedStatus: "reserved", buyer: req.user._id, reservedAt: new Date() } },
        { new: true, session }
      );

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: "이미 예약되었거나 판매 완료된 상품입니다." });
      }

      [chat] = await Chat.create(
        [{ product: product._id, buyer: req.user._id, seller: product.seller }],
        { session }
      );

      await session.commitTransaction();
    } catch (txError) {
      await session.abortTransaction();
      console.error("purchaseProduct transaction error:", txError.message);
      return res.status(500).json({ message: "서버 오류" });
    } finally {
      session.endSession();
    }

    // 거래 시작 — 판매자 totalDeals 증가
    await User.findByIdAndUpdate(product.seller, { $inc: { totalDeals: 1 } });

    return res.status(200).json({ message: "구매 예약 성공", product, chat });
  } catch (error) {
    console.error("purchaseProduct error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const confirmTrade = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Product.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }
    const isSeller = existing.seller.toString() === req.user._id.toString();
    const isBuyer = existing.buyer?.toString() === req.user._id.toString();
    if (!isSeller && !isBuyer) {
      return res.status(403).json({ message: "거래 당사자만 거래 완료 처리할 수 있습니다." });
    }
    if (existing.fixedStatus !== "reserved") {
      return res.status(400).json({ message: "예약 중인 상품만 거래 완료 처리할 수 있습니다." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let product;
    try {
      product = await Product.findOneAndUpdate(
        { _id: id, fixedStatus: "reserved" },
        { $set: { fixedStatus: "sold" } },
        { new: true, session }
      );

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: "이미 처리된 상품입니다." });
      }

      await session.commitTransaction();
    } catch (txError) {
      await session.abortTransaction();
      console.error("confirmTrade transaction error:", txError.message);
      return res.status(500).json({ message: "서버 오류" });
    } finally {
      session.endSession();
    }

    // 거래 완료 — 판매자 completedDeals 증가 + 브룩 지수 재계산
    await User.findByIdAndUpdate(existing.seller, { $inc: { completedDeals: 1 } });
    recalculateBrookScore(existing.seller).catch(() => {});

    // 거래 완료를 처리하지 않은 상대방에게 알림
    const io = req.app.get("io");
    const counterpartId = isSeller ? existing.buyer : existing.seller;
    if (counterpartId) {
      await createNotification(io, counterpartId, {
        type: "trade_confirmed",
        message: `"${existing.title}" 거래가 완료 처리되었습니다.`,
        productId: existing._id,
        productTitle: existing.title,
      });
    }

    return res.status(200).json({ message: "거래 완료", product });
  } catch (error) {
    console.error("confirmTrade error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const confirmAuctionTrade = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    if (product.saleType !== "auction" || product.auctionStatus !== "ended" || !product.winner)
      return res.status(400).json({ message: "낙찰된 경매만 거래 완료 처리할 수 있습니다." });
    const isSeller = product.seller.toString() === req.user._id.toString();
    const isWinner = product.winner.toString() === req.user._id.toString();
    if (!isSeller && !isWinner)
      return res.status(403).json({ message: "거래 당사자만 거래 완료 처리할 수 있습니다." });
    if (product.auctionTradeConfirmed)
      return res.status(400).json({ message: "이미 거래 완료된 상품입니다." });

    product.auctionTradeConfirmed = true;
    await product.save();

    // 거래 완료를 처리하지 않은 상대방에게 알림
    const io = req.app.get("io");
    const counterpartId = isSeller ? product.winner : product.seller;
    await createNotification(io, counterpartId, {
      type: "trade_confirmed",
      message: `"${product.title}" 거래가 완료되었습니다.`,
      productId: product._id,
      productTitle: product.title,
    });

    // 거래 완료 — 판매자 completedDeals 증가 + 브룩 지수 재계산
    await User.findByIdAndUpdate(product.seller, { $inc: { completedDeals: 1 } });
    recalculateBrookScore(product.seller).catch(() => {});

    return res.status(200).json({ message: "거래 완료", product });
  } catch (error) {
    console.error("confirmAuctionTrade error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const cancelPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Product.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }
    if (existing.fixedStatus !== "reserved") {
      return res.status(400).json({ message: "예약 중인 상품만 취소할 수 있습니다." });
    }

    const isBuyer = existing.buyer?.toString() === req.user._id.toString();
    const isSeller = existing.seller.toString() === req.user._id.toString();
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: "접근 권한이 없습니다." });
    }

    const previousBuyer = existing.buyer;

    const session = await mongoose.startSession();
    session.startTransaction();

    let product;
    try {
      product = await Product.findOneAndUpdate(
        { _id: id, fixedStatus: "reserved" },
        { $set: { fixedStatus: "available", buyer: null, reservedAt: null, tradeReminderSentAt: null } },
        { new: true, session }
      );

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: "이미 처리된 상품입니다." });
      }

      await session.commitTransaction();
    } catch (txError) {
      await session.abortTransaction();
      console.error("cancelPurchase transaction error:", txError.message);
      return res.status(500).json({ message: "서버 오류" });
    } finally {
      session.endSession();
    }

    return res.status(200).json({ message: "예약 취소 완료", product });
  } catch (error) {
    console.error("cancelPurchase error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};
