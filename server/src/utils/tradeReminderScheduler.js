import Product from "../models/Product.js";
import { createNotification } from "./notificationService.js";
import {
  TRADE_REMINDER_AFTER_MS,
  TRADE_REMINDER_SWEEP_INTERVAL_MS,
} from "../config/constants.js";

// 거래 완료 처리를 잊은 거래에 리마인더 알림 발송
export const sweepTradeReminders = async (io) => {
  try {
    const threshold = new Date(Date.now() - TRADE_REMINDER_AFTER_MS);

    const pending = await Product.find({
      tradeReminderSentAt: null,
      $or: [
        // 즉시구매: 예약된 채 방치
        { saleType: "fixed", fixedStatus: "reserved", reservedAt: { $lte: threshold } },
        // 경매: 낙찰됐는데 거래 완료 미처리
        {
          saleType: "auction",
          auctionStatus: "ended",
          winner: { $ne: null },
          auctionTradeConfirmed: false,
          endTime: { $lte: threshold },
        },
      ],
    }).select("_id title seller buyer winner saleType");

    for (const product of pending) {
      const counterpart = product.saleType === "fixed" ? product.buyer : product.winner;
      const recipients = [product.seller, counterpart].filter(Boolean);

      for (const userId of recipients) {
        await createNotification(io, userId, {
          type: "trade_reminder",
          message: `"${product.title}" 거래가 아직 완료 처리되지 않았습니다. 거래가 끝났다면 완료 처리해주세요.`,
          productId: product._id,
          productTitle: product.title,
        });
      }

      product.tradeReminderSentAt = new Date();
      await product.save();
    }

    if (pending.length > 0) {
      console.log(`tradeReminder: ${pending.length}건 리마인더 발송`);
    }
  } catch (error) {
    console.error("sweepTradeReminders error:", error.message);
  }
};

// 서버 시작 시 1회 실행 + 주기적 점검 등록
export const startTradeReminderSweep = (io) => {
  sweepTradeReminders(io).catch(() => {});
  setInterval(() => sweepTradeReminders(io).catch(() => {}), TRADE_REMINDER_SWEEP_INTERVAL_MS);
};
