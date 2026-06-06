import Product from "../models/Product.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";

export const getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user._id })
      .populate("seller", "name")
      .populate("winner", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "내 상품 조회 성공",
      products,
    });
  } catch (error) {
    console.error("getMyProducts error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getMyBids = async (req, res) => {
  try {
    const bids = await Bid.find({ bidder: req.user._id })
      .populate({
        path: "product",
        populate: [
          { path: "seller", select: "name" },
          { path: "winner", select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "내 입찰 내역 조회 성공",
      bids,
    });
  } catch (error) {
    console.error("getMyBids error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getMyWins = async (req, res) => {
  try {
    const products = await Product.find({
      winner: req.user._id,
      auctionStatus: "ended",
    })
      .populate("seller", "name")
      .populate("winner", "name")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      message: "내 낙찰 상품 조회 성공",
      products,
    });
  } catch (error) {
    console.error("getMyWins error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    const user = await User.findById(req.user._id).select("wishlist");
    const isWishlisted = user.wishlist.some((id) => id.toString() === productId);

    if (isWishlisted) {
      await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: productId } });
    } else {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { wishlist: productId } });
    }

    return res.status(200).json({ isWishlisted: !isWishlisted });
  } catch (error) {
    console.error("toggleWishlist error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("name createdAt brookScore completedDeals totalDeals cancelledDeals");
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("getUserProfile error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getMyPurchases = async (req, res) => {
  try {
    const products = await Product.find({
      buyer: req.user._id,
      saleType: "fixed",
    })
      .populate("seller", "name")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ message: "내 구매 내역 조회 성공", products });
  } catch (error) {
    console.error("getMyPurchases error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getMyWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("wishlist")
      .populate({
        path: "wishlist",
        select: "title category images saleType fixedPrice fixedStatus currentPrice auctionStatus",
      });

    // 삭제된 상품은 populate 시 null이 되므로 제거
    return res.status(200).json({ wishlist: user.wishlist.filter(Boolean) });
  } catch (error) {
    console.error("getMyWishlist error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// 판매자 통계 대시보드 — 요약/상태분포/월별 매출/인기 상품
export const getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user._id;

    const [facet] = await Product.aggregate([
      { $match: { seller: sellerId } },
      {
        $addFields: {
          isSold: {
            $or: [
              { $and: [{ $eq: ["$saleType", "fixed"] }, { $eq: ["$fixedStatus", "sold"] }] },
              { $and: [{ $eq: ["$saleType", "auction"] }, { $eq: ["$auctionTradeConfirmed", true] }] },
            ],
          },
          isActive: {
            $or: [
              { $and: [{ $eq: ["$saleType", "fixed"] }, { $in: ["$fixedStatus", ["available", "reserved"]] }] },
              { $and: [{ $eq: ["$saleType", "auction"] }, { $in: ["$auctionStatus", ["pending", "live"]] }] },
            ],
          },
          soldPrice: { $cond: [{ $eq: ["$saleType", "fixed"] }, "$fixedPrice", "$currentPrice"] },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
                totalViews: { $sum: "$views" },
                activeListings: { $sum: { $cond: ["$isActive", 1, 0] } },
                soldCount: { $sum: { $cond: ["$isSold", 1, 0] } },
                totalRevenue: { $sum: { $cond: ["$isSold", "$soldPrice", 0] } },
              },
            },
          ],
          statusBreakdown: [
            { $group: { _id: { saleType: "$saleType", fixedStatus: "$fixedStatus", auctionStatus: "$auctionStatus" }, count: { $sum: 1 } } },
          ],
          salesByMonth: [
            { $match: { isSold: true, soldAt: { $ne: null } } },
            {
              $group: {
                _id: { year: { $year: "$soldAt" }, month: { $month: "$soldAt" } },
                count: { $sum: 1 },
                revenue: { $sum: "$soldPrice" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],
          topViewed: [
            { $sort: { views: -1 } },
            { $limit: 5 },
            { $project: { _id: 1, title: 1, views: 1, saleType: 1 } },
          ],
        },
      },
    ]);

    const summary = facet.summary[0] ?? {
      totalProducts: 0, totalViews: 0, activeListings: 0, soldCount: 0, totalRevenue: 0,
    };

    // 상태 분포를 사람이 읽기 쉬운 라벨로 변환
    const statusLabels = { available: "판매중", reserved: "예약중", sold: "판매완료", pending: "경매대기", live: "경매중", ended: "경매종료" };
    const statusCounts = {};
    for (const row of facet.statusBreakdown) {
      const key = row._id.saleType === "fixed" ? row._id.fixedStatus : row._id.auctionStatus;
      const label = statusLabels[key] ?? "기타";
      statusCounts[label] = (statusCounts[label] ?? 0) + row.count;
    }
    const statusBreakdown = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    const salesByMonth = facet.salesByMonth.map((r) => ({
      month: `${r._id.year}-${String(r._id.month).padStart(2, "0")}`,
      count: r.count,
      revenue: r.revenue,
    }));

    return res.status(200).json({
      summary: { ...summary, _id: undefined },
      statusBreakdown,
      salesByMonth,
      topViewed: facet.topViewed,
    });
  } catch (error) {
    console.error("getSellerDashboard error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};