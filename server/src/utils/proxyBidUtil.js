import Product from "../models/Product.js";
import Bid from "../models/Bid.js";
import ProxyBid from "../models/ProxyBid.js";
import { getBidUnit } from "./bidUnit.js";
import { getAuctionRoom } from "./auctionScheduler.js";
import { createNotification } from "./notificationService.js";

/**
 * 자동 입찰 정산 (eBay 방식)
 * - 입찰자별 유효 최대치(프록시 max 또는 마지막 수동 입찰가)를 비교
 * - 최고 max 보유자가 리더가 되며, 가격은 2등 max + 한 단위(자기 max 한도)로만 올림
 * 수동 입찰 직후 또는 자동 입찰 설정 시 호출.
 */
export const settleProxyBids = async (productId, io) => {
  const product = await Product.findById(productId);
  if (!product || product.auctionStatus !== "live") return;

  const [proxies, highestBid] = await Promise.all([
    ProxyBid.find({ product: productId }),
    Bid.findOne({ product: productId }).sort({ amount: -1, createdAt: 1 }),
  ]);

  // 입찰자별 유효 최대치
  const effMax = new Map();
  for (const p of proxies) {
    effMax.set(p.bidder.toString(), p.maxAmount);
  }
  if (highestBid) {
    const id = highestBid.bidder.toString();
    effMax.set(id, Math.max(effMax.get(id) ?? 0, highestBid.amount));
  }
  if (effMax.size === 0) return;

  const entries = [...effMax.entries()].sort((a, b) => b[1] - a[1]);
  const [winnerId, winnerMax] = entries[0];
  const second = entries[1]; // [id, max] | undefined

  const currentPrice = product.currentPrice ?? product.startPrice ?? 0;
  const currentLeaderId = highestBid?.bidder.toString();

  let newPrice;
  if (second) {
    const unit = getBidUnit(second[1], product.bidTiers);
    newPrice = Math.min(winnerMax, second[1] + unit);
  } else {
    // 단독 참가자
    newPrice = currentPrice;
  }
  newPrice = Math.max(newPrice, currentPrice);

  // 리더 변동도 없고 가격 변동도 없으면 종료
  if (currentLeaderId === winnerId && newPrice === currentPrice) return;
  // 단독 참가자가 이미 리더면 종료(이미 최저가로 선점)
  if (!second && currentLeaderId === winnerId) return;

  // winner 명의로 자동 입찰 생성
  const [bid] = await Bid.create([{ product: productId, bidder: winnerId, amount: newPrice }]);
  const populatedBid = await Bid.findById(bid._id).populate("bidder", "name");
  product.currentPrice = newPrice;
  await product.save();

  // 직전 리더가 밀려났다면 알림
  if (currentLeaderId && currentLeaderId !== winnerId) {
    await createNotification(io, highestBid.bidder, {
      type: "outbid",
      message: `"${product.title}" 경매에서 자동 입찰로 더 높은 입찰이 들어왔습니다.`,
      productId: product._id,
      productTitle: product.title,
    });
  }

  io.to(getAuctionRoom(productId)).emit("auction:bid", {
    productId: String(productId),
    currentPrice: newPrice,
    bid: {
      id: String(populatedBid._id),
      bidder: populatedBid.bidder,
      amount: populatedBid.amount,
      createdAt: populatedBid.createdAt,
    },
    endTime: product.endTime,
    auto: true,
  });
};
