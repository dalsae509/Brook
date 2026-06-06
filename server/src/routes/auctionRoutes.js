import express from "express";
import rateLimit from "express-rate-limit";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  startAuction,
  scheduleAuction,
  cancelAuctionSchedule,
  placeBid,
  getBids,
  endAuction,
  setProxyBid,
  getMyProxyBid,
} from "../controllers/auctionController.js";

const router = express.Router();

const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "입찰 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

router.post("/:productId/start", authMiddleware, startAuction);
router.post("/:productId/schedule", authMiddleware, scheduleAuction);
router.delete("/:productId/schedule", authMiddleware, cancelAuctionSchedule);
router.post("/:productId/bid", authMiddleware, bidLimiter, placeBid);
router.post("/:productId/auto-bid", authMiddleware, bidLimiter, setProxyBid);
router.get("/:productId/auto-bid", authMiddleware, getMyProxyBid);
router.get("/:productId/bids", authMiddleware, getBids);
router.post("/:productId/end", authMiddleware, endAuction);

export default router;