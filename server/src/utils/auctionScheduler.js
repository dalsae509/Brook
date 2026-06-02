import Product from "../models/Product.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";
import { createNotification } from "./notificationService.js";

const auctionTimers = new Map();
const auctionStartTimers = new Map();

export const getAuctionRoom = (productId) => `auction:${productId}`;

export const clearAuctionTimer = (productId) => {
  const timer = auctionTimers.get(String(productId));
  if (timer) {
    clearTimeout(timer);
    auctionTimers.delete(String(productId));
  }
};

export const clearAuctionStartTimer = (productId) => {
  const timer = auctionStartTimers.get(String(productId));
  if (timer) {
    clearTimeout(timer);
    auctionStartTimers.delete(String(productId));
  }
};

export const finalizeAuction = async (productId, io, endedBy = "system") => {
  try {
    clearAuctionTimer(productId);

    const product = await Product.findById(productId);

    if (!product) {
      return null;
    }

    if (product.auctionStatus !== "live") {
      return null;
    }

    const highestBid = await Bid.findOne({ product: productId })
      .sort({ amount: -1, createdAt: 1 })
      .populate("bidder", "name");

    product.auctionStatus = "ended";
    product.endTime = new Date();

    if (highestBid) {
      product.winner = highestBid.bidder._id;
      product.currentPrice = highestBid.amount;
    } else if (product.onFailedAuction === "convert" && product.fixedPrice != null) {
      // 유찰 → 즉시 판매 전환
      product.saleType = "fixed";
      product.fixedStatus = "available";
    }

    await product.save();

    const payload = {
      productId: String(product._id),
      auctionStatus: product.auctionStatus,
      endTime: product.endTime,
      endedBy,
      winner: highestBid
        ? {
            id: String(highestBid.bidder._id),
            name: highestBid.bidder.name,
            amount: highestBid.amount,
          }
        : null,
      converted: !highestBid && product.saleType === "fixed",
    };

    io.to(getAuctionRoom(productId)).emit("auction:ended", payload);

    // 입찰자 알림
    const allBidderIds = await Bid.distinct("bidder", { product: productId });

    if (highestBid) {
      await createNotification(io, highestBid.bidder._id, {
        type: "auction_won",
        message: `"${product.title}" 경매에서 낙찰되었습니다! 낙찰가: ${highestBid.amount.toLocaleString()}원`,
        productId: product._id,
        productTitle: product.title,
      });

      for (const bidderId of allBidderIds) {
        if (bidderId.toString() !== highestBid.bidder._id.toString()) {
          await createNotification(io, bidderId, {
            type: "auction_ended",
            message: `"${product.title}" 경매가 종료되었습니다. 낙찰에 실패했습니다.`,
            productId: product._id,
            productTitle: product.title,
          });
        }
      }
    } else {
      for (const bidderId of allBidderIds) {
        await createNotification(io, bidderId, {
          type: "auction_ended",
          message: `"${product.title}" 경매가 유찰되었습니다.`,
          productId: product._id,
          productTitle: product.title,
        });
      }
    }

    return { product, payload };
  } catch (error) {
    console.error(`finalizeAuction error (productId: ${productId}):`, error.message);
    return null;
  }
};

export const scheduleAuctionEnd = (productId, endTime, io) => {
  clearAuctionTimer(productId);

  const delay = new Date(endTime).getTime() - Date.now();

  if (delay <= 0) {
    finalizeAuction(productId, io, "system");
    return;
  }

  const timer = setTimeout(
    () => { finalizeAuction(productId, io, "system"); },
    delay
  );

  auctionTimers.set(String(productId), timer);
};

// 경매 즉시/예약 시작 공통 로직
export const triggerAuctionStart = async (productId, durationMinutes, io) => {
  clearAuctionStartTimer(productId);

  const product = await Product.findById(productId);
  if (!product || product.auctionStatus !== "pending") return;

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  product.auctionStatus = "live";
  product.startTime = startTime;
  product.endTime = endTime;
  product.scheduledStartTime = null;
  product.scheduledDurationMinutes = null;
  await product.save();

  scheduleAuctionEnd(product._id, endTime, io);

  const payload = {
    productId: String(product._id),
    auctionStatus: product.auctionStatus,
    startTime: product.startTime,
    endTime: product.endTime,
    currentPrice: product.currentPrice,
  };
  io.to(getAuctionRoom(product._id)).emit("auction:started", payload);

  // 찜한 사용자 알림 (백그라운드)
  const sellerId = String(product.seller);
  User.find({ wishlist: productId }, "_id")
    .then((users) =>
      Promise.all(
        users
          .filter((u) => String(u._id) !== sellerId)
          .map((u) =>
            createNotification(io, u._id, {
              type: "wishlist_auction_started",
              message: `찜한 상품 "${product.title}"의 경매가 시작되었습니다!`,
              productId: product._id,
              productTitle: product.title,
            })
          )
      )
    )
    .catch((err) => console.error("wishlist notify error:", err));
};

export const scheduleAuctionStart = (productId, startTime, durationMinutes, io) => {
  clearAuctionStartTimer(productId);

  const delay = new Date(startTime).getTime() - Date.now();

  if (delay <= 0) {
    triggerAuctionStart(productId, durationMinutes, io);
    return;
  }

  const timer = setTimeout(
    () => { triggerAuctionStart(productId, durationMinutes, io); },
    delay
  );

  auctionStartTimers.set(String(productId), timer);
};

export const restoreAuctionTimers = async (io) => {
  const liveProducts = await Product.find({
    auctionStatus: "live",
    endTime: { $ne: null },
  });

  for (const product of liveProducts) {
    try {
      const endTime = new Date(product.endTime).getTime();

      if (endTime <= Date.now()) {
        await finalizeAuction(product._id, io, "system");
      } else {
        scheduleAuctionEnd(product._id, product.endTime, io);
      }
    } catch (error) {
      console.error(`restoreAuctionTimers error (productId: ${product._id}):`, error.message);
    }
  }
};

export const restoreAuctionStartTimers = async (io) => {
  const pendingProducts = await Product.find({
    auctionStatus: "pending",
    scheduledStartTime: { $ne: null },
    scheduledDurationMinutes: { $ne: null },
  });

  for (const product of pendingProducts) {
    try {
      scheduleAuctionStart(product._id, product.scheduledStartTime, product.scheduledDurationMinutes, io);
    } catch (error) {
      console.error(`restoreAuctionStartTimers error (productId: ${product._id}):`, error.message);
    }
  }
};
