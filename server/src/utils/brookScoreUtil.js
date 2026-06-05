import User from "../models/User.js";
import Review from "../models/Review.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

const RATING_DELTA = { 5: 1.0, 4: 0.5, 3: 0, 2: -0.5, 1: -1.0 };

export const recalculateBrookScore = async (userId) => {
  const [reviews, user] = await Promise.all([
    Review.find({ reviewee: userId }),
    User.findById(userId),
  ]);
  if (!user) return;

  let score = 36.5;

  // 후기 반영
  reviews.forEach((r) => { score += RATING_DELTA[r.rating] ?? 0; });

  // 거래 완료율 (최대 +10)
  if (user.totalDeals > 0) {
    const completionRate = Math.min(user.completedDeals / user.totalDeals, 1);
    score += completionRate * 10;
  }

  // 응답률 (채팅 응답 비율 > 50% 구간만 최대 +5)
  const sellerChats = await Chat.find({ seller: userId }).select("_id");
  if (sellerChats.length > 0) {
    const respondedIds = await Message.distinct("chat", {
      chat: { $in: sellerChats.map((c) => c._id) },
      sender: userId,
    });
    const responseRate = respondedIds.length / sellerChats.length;
    score += Math.max(0, responseRate - 0.5) * 10; // 50% 초과분에 최대 +5
  }

  // 신고 패널티 (건당 -3)
  score -= user.reportCount * 3;

  // 범위 고정
  score = Math.max(0, Math.min(99, Math.round(score * 10) / 10));

  await User.findByIdAndUpdate(userId, { brookScore: score });
  return score;
};
